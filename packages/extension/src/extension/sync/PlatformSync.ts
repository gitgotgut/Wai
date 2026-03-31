import * as vscode from "vscode";
import type { SyncPayload, SyncResponse } from "@wai/shared";

export interface PlatformSyncConfig {
  platformUrl: string;
  syncToken: string;
  deviceId: string;
  syncIntervalMs: number; // 30 minutes default
}

export interface SyncResult {
  success: boolean;
  error?: string;
  nextSyncAt?: number;
  syncedAt: number;
}

/**
 * Manages synchronization between VS Code extension and Wai platform.
 * Handles periodic uploads of local coding stats.
 */
export class PlatformSync {
  private config: PlatformSyncConfig | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private lastSyncResult: SyncResult | null = null;
  private isSyncing = false;

  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Initialize sync with platform config.
   * Call this after user authenticates and retrieves token from platform.
   */
  async initialize(config: PlatformSyncConfig): Promise<void> {
    this.config = config;
    this.outputChannel.appendLine(
      `[PlatformSync] Initialized for ${config.deviceId} at ${config.platformUrl}`
    );

    // Start periodic sync
    this.scheduleSyncTimer();
  }

  /**
   * Trigger an immediate sync.
   * Returns result of sync attempt.
   */
  async syncNow(statsSnapshot: Record<string, unknown>): Promise<SyncResult> {
    if (!this.config) {
      return {
        success: false,
        error: "Sync not initialized. Configure token in settings first.",
        syncedAt: Date.now(),
      };
    }

    if (this.isSyncing) {
      this.outputChannel.appendLine("[PlatformSync] Sync already in progress, skipping...");
      return {
        success: false,
        error: "Sync already in progress",
        syncedAt: Date.now(),
      };
    }

    this.isSyncing = true;

    try {
      const payload: SyncPayload = {
        deviceId: this.config.deviceId,
        statsSnapshot: statsSnapshot as any, // Type assertion OK for now
      };

      const response = await fetch(`${this.config.platformUrl}/api/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.syncToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as SyncResponse & { nextSyncAt?: number };

      if (!response.ok) {
        const error = data.error || `HTTP ${response.status}`;
        this.outputChannel.appendLine(`[PlatformSync] Sync failed: ${error}`);
        this.lastSyncResult = {
          success: false,
          error,
          syncedAt: Date.now(),
        };
        return this.lastSyncResult;
      }

      this.outputChannel.appendLine(
        `[PlatformSync] Sync successful at ${new Date().toISOString()}`
      );

      this.lastSyncResult = {
        success: true,
        nextSyncAt: data.nextSyncAt,
        syncedAt: Date.now(),
      };

      // Reschedule timer based on server response
      if (data.nextSyncAt) {
        const delayMs = Math.max(0, data.nextSyncAt - Date.now());
        this.rescheduleSync(delayMs);
      }

      return this.lastSyncResult;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error during sync";
      this.outputChannel.appendLine(`[PlatformSync] Sync error: ${errorMsg}`);

      this.lastSyncResult = {
        success: false,
        error: errorMsg,
        syncedAt: Date.now(),
      };

      return this.lastSyncResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get last sync result.
   */
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  /**
   * Schedule the next sync based on config interval.
   */
  private scheduleSyncTimer(): void {
    if (!this.config) return;

    this.clearSyncTimer();

    this.syncTimer = setTimeout(() => {
      // Note: Extension would call syncNow with current stats from EventCollector
      this.outputChannel.appendLine(
        `[PlatformSync] Scheduled sync time reached (interval: ${this.config?.syncIntervalMs}ms)`
      );
      // syncNow would be called here by extension.ts passing current stats
    }, this.config.syncIntervalMs);
  }

  /**
   * Reschedule sync with custom delay.
   */
  private rescheduleSync(delayMs: number): void {
    this.clearSyncTimer();
    this.syncTimer = setTimeout(() => {
      this.scheduleSyncTimer();
    }, delayMs);

    this.outputChannel.appendLine(
      `[PlatformSync] Rescheduled sync in ${(delayMs / 1000 / 60).toFixed(1)} minutes`
    );
  }

  /**
   * Clear any active sync timer.
   */
  private clearSyncTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Cleanup on extension deactivation.
   */
  async dispose(): Promise<void> {
    this.clearSyncTimer();
    this.outputChannel.appendLine("[PlatformSync] Disposed");
  }
}
