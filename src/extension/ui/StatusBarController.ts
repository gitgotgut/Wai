import * as vscode from "vscode";
import type { SessionStats } from "../collectors/EventCollector";

const THROTTLE_MS = 2_000;

/**
 * Persistent status bar item showing live AI usage percentage.
 * Throttles visual updates to once every 2 seconds.
 */
export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private throttled = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "wai.openDashboard";
    this.item.text = "$(wand) Wai";
    this.item.tooltip = "Wai — Click to open dashboard";
    this.item.show();
  }

  update(stats: SessionStats): void {
    if (this.throttled) return;
    this.throttled = true;
    setTimeout(() => { this.throttled = false; }, THROTTLE_MS);

    const total = stats.aiGenerated + stats.humanTyping;
    const aiPct = total > 0 ? Math.round((stats.aiGenerated / total) * 100) : 0;

    this.item.text = `$(wand) AI ${aiPct}%`;
    this.item.tooltip = `Wai — AI: ${stats.aiLinesGenerated} lines | Human: ${stats.humanLinesTyped} lines | Click to open dashboard`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
