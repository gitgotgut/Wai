import * as vscode from "vscode";
import type { SessionStats } from "../collectors/EventCollector";

/**
 * Exports collected statistics to a user-chosen file (JSON or CSV).
 */
export class StatsExporter {
  static async export(stats: SessionStats): Promise<void> {
    const format = await vscode.window.showQuickPick(["JSON", "CSV"], {
      placeHolder: "Select export format",
    });
    if (!format) return;

    const ext = format.toLowerCase();
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`wai-export.${ext}`),
      filters: format === "JSON" ? { JSON: ["json"] } : { CSV: ["csv"] },
    });
    if (!uri) return;

    const content = format === "JSON" ? StatsExporter.toJson(stats) : StatsExporter.toCsv(stats);

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    vscode.window.showInformationMessage(`Wai: Export saved to ${uri.fsPath}`);
  }

  private static toJson(stats: SessionStats): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        allTime: stats,
        dailyHistory: stats.dailyHistory,
        byLanguage: stats.byLanguage,
      },
      null,
      2,
    );
  }

  private static toCsv(stats: SessionStats): string {
    const header = "date,aiGenerated,humanTyping,pastes,aiLinesGenerated,humanLinesTyped";
    const rows = (stats.dailyHistory ?? []).map(
      (d) =>
        `${d.date},${d.aiGenerated},${d.humanTyping},${d.pastes},${d.aiLinesGenerated},${d.humanLinesTyped}`,
    );
    return [header, ...rows].join("\n");
  }
}
