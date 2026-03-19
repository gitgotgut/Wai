# Phase 3 Prompt — Insights & Delight

You are continuing development of **Wai**, a VS Code extension that tracks AI coding usage. Phase 1 and Phase 2 are complete. Read `CLAUDE.md` first for full project context and coding conventions.

## Prerequisites — Verify Before Starting

Phase 2 must be complete. Confirm these exist in the codebase:
- `SessionStats.dailyHistory: DailySnapshot[]` — 30-day rolling history
- `SessionStats.aiLinesGenerated` and `humanLinesTyped` — line counts
- `SessionStats.byLanguage` — per-language breakdown
- `src/extension/ui/StatusBarController.ts` — status bar indicator

If any are missing, implement them from `feature/phase-2-core-value.md` first.

---

## Your Task

Implement Phase 3: turn raw data into insights developers act on. Build the following 3 features.

---

## Feature 1: 7-Day Activity Chart (SVG, no external libraries)

Replace the placeholder in `src/webview/components/ActivityChart.tsx` with a real SVG bar chart.

**Requirements**:
- Accept `dailyHistory: DailySnapshot[]` as a prop
- Show the last 7 days (or fewer if less data exists)
- Stacked bars: AI lines (blue `#3794ff`) on top of human lines (gray `#6e6e6e`)
- X-axis: day labels ("Mon", "Tue", etc. — derive from the ISO date string)
- Y-axis: lines of code (auto-scale to max value in the 7-day window)
- Gridlines: 3 horizontal lines at 25%, 50%, 75% of max
- Tooltip on hover: show exact AI and human line counts for that day
- If `dailyHistory` is empty or has fewer than 2 entries: show a friendly "Keep coding — your chart will appear after a couple of days" message
- Use only React and SVG — **no Chart.js, D3, recharts, or any npm charting library** (CSP compliance + bundle size)
- All colours must use VS Code CSS variables where possible (`var(--vscode-textLink-foreground)` for AI blue)

**Wire into `src/webview/App.tsx`**:
- Pass `stats?.dailyHistory ?? []` to `<ActivityChart dailyHistory={...} />`

**Update `src/webview/App.tsx` message handler**:
- Ensure `statsUpdate` messages include `dailyHistory` (it should already be part of `SessionStats`)

---

## Feature 2: Weekly Digest Notification

Create `src/extension/ui/DigestNotifier.ts`:

```typescript
export class DigestNotifier {
  constructor(private readonly state: StateManager) {}
  async maybeNotify(): Promise<void>
}
```

**Logic in `maybeNotify()`**:
1. Read `lastDigestDate` from `StateManager` (key: `wai.lastDigestDate`)
2. If today is not Monday (`new Date().getDay() !== 1`), return early
3. If `lastDigestDate` equals today's ISO date, return early (already sent today)
4. Read current `SessionStats` from state
5. Calculate:
   - Total AI lines this week: sum last 7 `dailyHistory` entries' `aiLinesGenerated`
   - AI rate this week: `weekAiLines / (weekAiLines + weekHumanLines) * 100`
   - Week-over-week change: compare this week's total to previous 7 days (if data exists)
6. Show notification via `vscode.window.showInformationMessage`:
   ```
   Wai Weekly: You shipped X AI lines this week (XX% AI rate). [Open Dashboard]
   ```
   If week-over-week data available, append: `Up/Down X% from last week.`
7. If user clicks "Open Dashboard": execute `wai.openDashboard`
8. Save today's date to `wai.lastDigestDate`

**Wire into `src/extension/extension.ts`**:
- Instantiate `DigestNotifier` in `activate()`
- Call `await notifier.maybeNotify()` after restoring stats (non-blocking, wrap in try-catch)

---

## Feature 3: Export to CSV / JSON

**Create `src/extension/exporters/StatsExporter.ts`**:

```typescript
export class StatsExporter {
  static async export(stats: SessionStats): Promise<void>
}
```

**Implementation**:
1. Prompt the user to pick a format:
   ```typescript
   const format = await vscode.window.showQuickPick(['JSON', 'CSV'], {
     placeHolder: 'Select export format'
   });
   ```
2. Prompt for save location:
   ```typescript
   const uri = await vscode.window.showSaveDialog({
     defaultUri: vscode.Uri.file(`wai-export.${format.toLowerCase()}`),
     filters: format === 'JSON' ? { 'JSON': ['json'] } : { 'CSV': ['csv'] }
   });
   ```
3. Generate the file content:
   - **JSON**: `JSON.stringify({ exportedAt, allTime: stats, dailyHistory: stats.dailyHistory, byLanguage: stats.byLanguage }, null, 2)`
   - **CSV**: One row per `DailySnapshot`:
     ```
     date,aiGenerated,humanTyping,pastes,aiLinesGenerated,humanLinesTyped
     2026-03-19,1234,567,89,45,20
     ```
4. Write the file using `vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'))`
5. Show success: `vscode.window.showInformationMessage('Wai: Export saved to ' + uri.fsPath)`

**Register the command** in `src/extension/extension.ts`:
```typescript
vscode.commands.registerCommand('wai.exportStats', () => StatsExporter.export(sessionTracker.getStats()))
```

**Add to `package.json`** under `contributes.commands`:
```json
{ "command": "wai.exportStats", "title": "Wai: Export Statistics" }
```

---

## Acceptance Criteria

- [ ] `ActivityChart` renders stacked SVG bars for the last 7 days of `dailyHistory`
- [ ] Chart shows correct day labels and scales to max value
- [ ] Chart renders gracefully with 0, 1, or 7+ days of data
- [ ] On Monday (first activation of the day), a notification appears with last week's AI line count
- [ ] Notification includes an "Open Dashboard" button that works
- [ ] Notification does not fire again on the same day
- [ ] `wai.exportStats` command appears in the Command Palette
- [ ] JSON export is valid JSON containing `dailyHistory` array
- [ ] CSV export has a header row and one data row per `DailySnapshot`
- [ ] Build passes: `npm run compile`
- [ ] Commit and push to GitHub when complete

## Build & Test

```bash
npm run compile      # must succeed with no errors
npm run watch        # use during development
```

**Manual chart test**: After coding for 2+ days, open dashboard and verify bars appear for each day. If testing immediately, temporarily populate `dailyHistory` with mock data in `SessionTracker.restore()` to verify rendering.

**Manual digest test**: Temporarily change the day check from `=== 1` (Monday) to `!== -1` (always) to trigger the notification on demand. Revert before committing.
