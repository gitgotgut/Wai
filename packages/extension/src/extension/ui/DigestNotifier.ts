import * as vscode from "vscode";
import type { StateManager } from "../storage/StateManager";
import type { SessionStats } from "../collectors/EventCollector";

const LAST_DIGEST_KEY = "wai.lastDigestDate";

/**
 * Fires a weekly digest notification on Monday mornings (once per day).
 * Summarises the previous week's AI line count and AI rate.
 */
export class DigestNotifier {
  constructor(private readonly state: StateManager) {}

  async maybeNotify(stats: SessionStats): Promise<void> {
    const today = new Date();

    // Only fire on Mondays
    if (today.getDay() !== 1) {
      return;
    }

    const todayIso = today.toISOString().split("T")[0];
    const lastDigestDate = await this.state.getGlobalState<string>(LAST_DIGEST_KEY);

    // Already sent today
    if (lastDigestDate === todayIso) {
      return;
    }

    const history = stats.dailyHistory ?? [];

    // Last 7 entries = this week, previous 7 = last week
    const thisWeek = history.slice(-7);
    const prevWeek = history.slice(-14, -7);

    const weekAiLines = thisWeek.reduce((sum, d) => sum + d.aiLinesGenerated, 0);
    const weekHumanLines = thisWeek.reduce((sum, d) => sum + d.humanLinesTyped, 0);

    if (weekAiLines + weekHumanLines === 0) {
      // No data yet — nothing useful to show
      return;
    }

    const aiRate = Math.round((weekAiLines / (weekAiLines + weekHumanLines)) * 100);

    let message = `Wai Weekly: You shipped ${weekAiLines} AI lines this week (${aiRate}% AI rate).`;

    if (prevWeek.length > 0) {
      const prevAiLines = prevWeek.reduce((sum, d) => sum + d.aiLinesGenerated, 0);
      const delta = weekAiLines - prevAiLines;
      if (delta !== 0) {
        const sign = delta > 0 ? "Up" : "Down";
        const pct = prevAiLines > 0 ? Math.abs(Math.round((delta / prevAiLines) * 100)) : 100;
        message += ` ${sign} ${pct}% from last week.`;
      }
    }

    const selection = await vscode.window.showInformationMessage(message, "Open Dashboard");
    if (selection === "Open Dashboard") {
      await vscode.commands.executeCommand("wai.openDashboard");
    }

    await this.state.setGlobalState(LAST_DIGEST_KEY, todayIso);
  }
}
