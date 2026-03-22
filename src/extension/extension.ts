import * as vscode from "vscode";
import { ChangeClassifier, isTrackedLanguage } from "./heuristics/ChangeClassifier";
import { TabAcceptTracker } from "./heuristics/TabAcceptTracker";
import { EventCollector } from "./collectors/EventCollector";
import { SessionTracker } from "./collectors/SessionTracker";
import { StateManager } from "./storage/StateManager";
import { SecretManager } from "./storage/SecretManager";
import { DashboardPanel } from "./webview/DashboardPanel";
import { StatusBarController } from "./ui/StatusBarController";
import { DigestNotifier } from "./ui/DigestNotifier";
import { TokenPoller } from "./api/TokenPoller";
import { StatsExporter } from "./exporters/StatsExporter";

const SYNC_INTERVAL_MS = 30_000;

let sessionTracker: SessionTracker | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Wai");
  output.appendLine("Wai extension activating...");

  // ── Initialise core services ──────────────────────────────────────
  const stateManager = new StateManager(context);
  const secretManager = new SecretManager(stateManager);
  const tabTracker = new TabAcceptTracker();
  const changeClassifier = new ChangeClassifier(tabTracker);
  const eventCollector = new EventCollector();
  sessionTracker = new SessionTracker(stateManager, eventCollector);

  await sessionTracker.restore();

  // ── Weekly digest notification ────────────────────────────────────
  const digestNotifier = new DigestNotifier(stateManager);
  try {
    await digestNotifier.maybeNotify(sessionTracker.getStats());
  } catch (err) {
    output.appendLine(`Wai: digest notification error: ${err}`);
  }

  // ── Status bar ────────────────────────────────────────────────────
  const statusBar = new StatusBarController();
  statusBar.update(sessionTracker.getStats());
  context.subscriptions.push(statusBar);

  // ── Token poller ──────────────────────────────────────────────────
  const tokenPoller = new TokenPoller(
    stateManager,
    secretManager,
    output,
    () => sessionTracker?.getStats().aiGenerated ?? 0,
  );

  // Start polling if any API key is stored
  const hasKey = (await secretManager.getApiKey("openai")) || (await secretManager.getApiKey("anthropic"));
  if (hasKey) {
    tokenPoller.start();
  }
  context.subscriptions.push({ dispose: () => tokenPoller.stop() });

  // ── Commands ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("wai.openDashboard", async () => {
      const dashboard = DashboardPanel.createOrShow(context.extensionUri, (msg) => {
        handleWebviewMessage(msg, sessionTracker!, dashboard);
      });
      dashboard.postStats(sessionTracker!.getStats());

      const tokenUsage = await tokenPoller.getLastUsage();
      if (tokenUsage) {
        dashboard.postTokenUsage(tokenUsage);
      }
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

      await secretManager.setApiKey(provider as "openai" | "anthropic", key);
      vscode.window.showInformationMessage(
        `Wai: ${provider} API key stored securely (${SecretManager.mask(key)}).`,
      );

      // Start polling now that we have a key
      tokenPoller.start();
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

      statusBar.update(sessionTracker!.getStats());
      DashboardPanel.current?.postStats(sessionTracker!.getStats());
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wai.exportStats", () =>
      StatsExporter.export(sessionTracker!.getStats()),
    ),
  );

  // ── Tab-accept keybinding command ─────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("wai.recordTabAccept", async () => {
      tabTracker.recordTabPress();
      await vscode.commands.executeCommand("tab");
    }),
  );

  // ── Text change listener (core data collection) ───────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!isTrackedLanguage(event.document.languageId)) return;
      if (event.document.uri.scheme !== "file") return;

      for (const change of event.contentChanges) {
        const result = changeClassifier.classify(change);
        eventCollector.recordChange(result, event.document.languageId, change.text);
      }

      // Live status bar update (throttled internally)
      statusBar.update(sessionTracker!.getStats());
    }),
  );

  // ── Periodic persistence ──────────────────────────────────────────
  const syncInterval = setInterval(async () => {
    if (eventCollector.eventCount > 0) {
      await sessionTracker!.persist();

      const stats = sessionTracker!.getStats();
      statusBar.update(stats);
      DashboardPanel.current?.postStats(stats);

      const tokenUsage = await tokenPoller.getLastUsage();
      if (tokenUsage) {
        DashboardPanel.current?.postTokenUsage(tokenUsage);
      }
    }
  }, SYNC_INTERVAL_MS);

  context.subscriptions.push({ dispose: () => clearInterval(syncInterval) });

  output.appendLine("Wai extension activated.");
}

export async function deactivate(): Promise<void> {
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
