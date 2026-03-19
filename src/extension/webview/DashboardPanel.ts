import * as vscode from "vscode";
import type { SessionStats } from "../collectors/EventCollector";

/**
 * Manages the lifecycle of the Wai dashboard webview panel.
 * Handles CSP nonce injection, IPC message passing, and singleton pattern.
 */
export class DashboardPanel {
  public static current: DashboardPanel | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.panel.webview.html = this.buildHtml();
    this.panel.onDidDispose(() => {
      DashboardPanel.current = undefined;
    });
  }

  static createOrShow(
    extensionUri: vscode.Uri,
    onMessage: (msg: { command: string }) => void,
  ): DashboardPanel {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(vscode.ViewColumn.One);
      return DashboardPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      "waiDashboard",
      "Wai Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    const instance = new DashboardPanel(panel, extensionUri);
    panel.webview.onDidReceiveMessage(onMessage);
    DashboardPanel.current = instance;
    return instance;
  }

  /** Push a stats snapshot to the webview. */
  postStats(stats: SessionStats): void {
    this.panel.webview.postMessage({ type: "statsUpdate", payload: stats });
  }

  // ── Private helpers ───────────────────────────────────────────────

  private buildHtml(): string {
    const nonce = DashboardPanel.getNonce();
    const webview = this.panel.webview;

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "dashboard.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "dashboard.css"),
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 script-src 'nonce-${nonce}';
                 style-src ${webview.cspSource} 'nonce-${nonce}';
                 img-src data:;">
  <title>Wai Dashboard</title>
  <link nonce="${nonce}" rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private static getNonce(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }
}
