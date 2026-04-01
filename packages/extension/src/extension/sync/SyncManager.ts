import * as vscode from "vscode";
import { PlatformSync, type PlatformSyncConfig, type SyncResult } from "./PlatformSync";
import type { SessionTracker } from "../collectors/SessionTracker";
import type { StateManager } from "../storage/StateManager";

const SYNC_TOKEN_KEY = "wai.platform.syncToken";
const DEVICE_ID_KEY = "wai.platform.deviceId";
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * High-level orchestrator for platform sync.
 * Bridges PlatformSync with the extension's SessionTracker and StateManager.
 */
export class SyncManager {
  private platformSync: PlatformSync;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private stateManager: StateManager,
    private outputChannel: vscode.OutputChannel,
    private sessionTracker: SessionTracker,
  ) {
    this.platformSync = new PlatformSync(outputChannel);
  }

  /**
   * Try to initialize sync from stored settings.
   * Returns true if sync was configured and started.
   */
  async tryInitialize(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration("wai.platform");
    const enabled = config.get<boolean>("enabled", false);
    if (!enabled) {
      this.outputChannel.appendLine("[SyncManager] Platform sync disabled in settings.");
      return false;
    }

    const token = await this.stateManager.getSecret(SYNC_TOKEN_KEY);
    if (!token) {
      this.outputChannel.appendLine("[SyncManager] No sync token configured.");
      return false;
    }

    const platformUrl = config.get<string>("url", "https://wai.example.com");
    const deviceId = await this.getOrCreateDeviceId();

    const syncConfig: PlatformSyncConfig = {
      platformUrl,
      syncToken: token,
      deviceId,
      syncIntervalMs: SYNC_INTERVAL_MS,
    };

    await this.platformSync.initialize(syncConfig);

    // Start periodic sync
    this.startPeriodicSync();

    // Do an initial sync right away
    this.sync().catch((err) => {
      this.outputChannel.appendLine(`[SyncManager] Initial sync error: ${err}`);
    });

    return true;
  }

  /**
   * Store a sync token (from user input) and reinitialize.
   */
  async setToken(token: string): Promise<void> {
    await this.stateManager.setSecret(SYNC_TOKEN_KEY, token);

    // Enable sync automatically when token is set
    await vscode.workspace
      .getConfiguration("wai.platform")
      .update("enabled", true, vscode.ConfigurationTarget.Global);

    // Reinitialize with new token
    await this.tryInitialize();
  }

  /**
   * Perform a sync with current stats.
   */
  async sync(): Promise<SyncResult> {
    const stats = this.sessionTracker.getStats();
    return this.platformSync.syncNow(stats as unknown as Record<string, unknown>);
  }

  /**
   * Get or create a stable device ID for this machine.
   * Uses vscode.env.machineId which is stable per VS Code installation.
   */
  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = this.context.globalState.get<string>(DEVICE_ID_KEY);
    if (!deviceId) {
      // Use VS Code's stable machine identifier, truncated
      deviceId = vscode.env.machineId.slice(0, 32);
      await this.context.globalState.update(DEVICE_ID_KEY, deviceId);
      this.outputChannel.appendLine(`[SyncManager] Generated device ID: ${deviceId}`);
    }
    return deviceId;
  }

  /**
   * Start the 30-minute sync interval.
   */
  private startPeriodicSync(): void {
    this.stopPeriodicSync();
    this.syncTimer = setInterval(async () => {
      const result = await this.sync();
      if (!result.success) {
        this.outputChannel.appendLine(`[SyncManager] Periodic sync failed: ${result.error}`);
      }
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stop the periodic sync timer.
   */
  private stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Cleanup on extension deactivation.
   */
  async dispose(): Promise<void> {
    this.stopPeriodicSync();
    // Final sync attempt before shutdown
    try {
      const result = await this.sync();
      this.outputChannel.appendLine(
        `[SyncManager] Final sync: ${result.success ? "OK" : result.error}`,
      );
    } catch {
      // Best-effort; don't block deactivation
    }
    await this.platformSync.dispose();
  }
}
