import * as vscode from "vscode";
import { ChangeClassifier, isTrackedLanguage } from "./heuristics/ChangeClassifier";
import { EventCollector } from "./collectors/EventCollector";
import { SessionTracker } from "./collectors/SessionTracker";
import { StateManager } from "./storage/StateManager";
import { SecretManager } from "./storage/SecretManager";
import { DashboardPanel } from "./webview/DashboardPanel";

const SYNC_INTERVAL_MS = 30_000;

let sessionTracker: SessionTracker | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Wai");
  output.appendLine("Wai extension activating...");

  // ── Initialise core services ──────────────────────────────────────
  const stateManager = new StateManager(context);
  const _secretManager = new SecretManager(stateManager); // used in Phase 2
  const changeClassifier = new ChangeClassifier();
  const eventCollector = new EventCollector();
  sessionTracker = new SessionTracker(stateManager, eventCollector);

  await sessionTracker.restore();

  // ── Commands ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("wai.openDashboard", () => {
      const dashboard = DashboardPanel.createOrShow(context.extensionUri, (msg) => {
        handleWebviewMessage(msg, sessionTracker!, dashboard);
      });
      dashboard.postStats(sessionTracker!.getStats());
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wai.inputApiKey", async () => {
      const provider = await vscode.window.showQuickPick(["openai", "anthropic"], {
        placeHolder: "Select API provider",
      });
      if (!provider) return;

      const key = await vscode.window.showInputBox({
        prompt: `Enter your ${provider} API key`,
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;

      await _secretManager.setApiKey(provider as "openai" | "anthropic", key);
      vscode.window.showInformationMessage(
        `Wai: ${provider} API key stored securely (${SecretManager.mask(key)}).`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wai.resetStats", async () => {
      const confirm = await vscode.window.showWarningMessage(
        "Wai: This will permanently delete all collected statistics. Continue?",
        { modal: true },
        "Reset",
      );
      if (confirm !== "Reset") return;

      await sessionTracker!.reset();
      vscode.window.showInformationMessage("Wai: Statistics have been reset.");

      // Update dashboard if open
      DashboardPanel.current?.postStats(sessionTracker!.getStats());
    }),
  );

  // ── Text change listener (core data collection) ───────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!isTrackedLanguage(event.document.languageId)) return;
      if (event.document.uri.scheme !== "file") return;

      for (const change of event.contentChanges) {
        const result = changeClassifier.classify(change);
        eventCollector.recordChange(result, event.document.languageId);
      }
    }),
  );

  // ── Periodic persistence ──────────────────────────────────────────
  const syncInterval = setInterval(async () => {
    if (eventCollector.eventCount > 0) {
      await sessionTracker!.persist();

      // Push live update to dashboard if visible
      DashboardPanel.current?.postStats(sessionTracker!.getStats());
    }
  }, SYNC_INTERVAL_MS);

  context.subscriptions.push({ dispose: () => clearInterval(syncInterval) });

  output.appendLine("Wai extension activated.");
}

export async function deactivate(): Promise<void> {
  // Final flush before shutdown
  await sessionTracker?.persist();
}

// ── Webview IPC handler ──────────────────────────────────────────────

function handleWebviewMessage(
  msg: { command: string },
  tracker: SessionTracker,
  dashboard: DashboardPanel,
): void {
  switch (msg.command) {
    case "getStats":
      dashboard.postStats(tracker.getStats());
      break;
    case "resetStats":
      tracker.reset().then(() => {
        dashboard.postStats(tracker.getStats());
      });
      break;
  }
}
