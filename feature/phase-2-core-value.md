# Phase 2 Prompt — Core Value Features

You are continuing development of **Wai**, a VS Code extension that tracks AI coding usage via text-change heuristics. Phase 1 is complete and deployed to GitHub at `https://github.com/gitgotgut/Wai`. Read `CLAUDE.md` first for full project context and coding conventions.

## Your Task

Implement Phase 2: make the extension visible and meaningful in daily use. Build the following 5 features in order.

---

## Feature 1: Status Bar Real-Time Indicator

Create `src/extension/ui/StatusBarController.ts`:
- Create a `StatusBarItem` (alignment: Right, priority: 100)
- Display text: `$(wand) AI XX%` where XX is `aiGenerated / (aiGenerated + humanTyping) * 100` for the current session
- Tooltip: `Wai — AI: X lines | Human: X lines | Click to open dashboard`
- `command`: `wai.openDashboard` (click opens the panel)
- Expose an `update(stats: SessionStats)` method
- Throttle updates to at most once every 2 seconds (use a `setTimeout` flag)
- Add `show()` and `dispose()` methods

Wire it up in `src/extension/extension.ts`:
- Instantiate `StatusBarController` in `activate()`
- Call `controller.update()` inside the `onDidChangeTextDocument` listener (after recording the change)
- Call `controller.update()` inside the periodic sync interval
- Add to `context.subscriptions`

---

## Feature 2: Lines of Code Tracking

**Update the data model** in `src/extension/collectors/EventCollector.ts`:
- Add `aiLinesGenerated: number` and `humanLinesTyped: number` to `SessionStats`
- In `flush()`, count newlines (`\n`) in each `ChangeEvent`'s text and accumulate into line totals
- Export the updated `SessionStats` interface (it is imported by multiple files)

**Update `src/extension/collectors/SessionTracker.ts`**:
- In `restore()`, default `aiLinesGenerated` and `humanLinesTyped` to `0` if missing (migration safety)
- In `persist()`, accumulate line deltas from the flushed result into `this.allTime`

**Update `src/webview/components/MetricsSummary.tsx`**:
- Make "AI Lines" and "Human Lines" the two hero metric cards (large, top row)
- Move character counts to a secondary row, smaller font
- Recalculate AI Rate as `(aiLinesGenerated / (aiLinesGenerated + humanLinesTyped)) * 100`

---

## Feature 3: Daily Time-Series History

**Add to `src/extension/collectors/EventCollector.ts`**:
```typescript
export interface DailySnapshot {
  date: string;              // "YYYY-MM-DD"
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}
```
Add `dailyHistory: DailySnapshot[]` to `SessionStats`. Default to `[]`.

**Update `src/extension/collectors/SessionTracker.ts`** — in `persist()`:
- Get today's ISO date string: `new Date().toISOString().split('T')[0]`
- Find existing entry in `this.allTime.dailyHistory` where `entry.date === today`
- If found: add today's delta to it (upsert pattern)
- If not found: push a new `DailySnapshot` for today
- Trim `dailyHistory` to last 30 entries (by date, oldest first)
- In `restore()`, default `dailyHistory` to `[]` if missing

---

## Feature 4: Per-Language Breakdown

**Update `src/extension/collectors/EventCollector.ts`**:
- Store per-language accumulators in `flush()` return value:
  ```typescript
  byLanguage: Record<string, { ai: number; human: number; aiLines: number; humanLines: number }>
  ```
- Aggregate from `ChangeEvent.languageId` during flush

**Update `src/extension/collectors/SessionTracker.ts`**:
- Add `byLanguage` to `SessionStats` (default `{}` in `restore()`)
- In `persist()`, merge the delta's `byLanguage` into `this.allTime.byLanguage` (add, don't replace)

**Create `src/webview/components/LanguageBreakdown.tsx`**:
- Accept `byLanguage` prop
- Display top 5 languages sorted by total activity (ai + human chars)
- For each: show language name, a small inline bar (AI% blue, human% gray), and the line count
- Show nothing if `byLanguage` is empty or undefined

**Wire into `src/webview/App.tsx`**:
- Render `<LanguageBreakdown byLanguage={stats.byLanguage} />` below MetricsSummary

---

## Feature 5: API Token Polling

**Create `src/extension/api/providers/OpenAIProvider.ts`**:
```typescript
export interface TokenUsage {
  provider: string;
  used: number;       // tokens used today
  limit: number;      // monthly limit (if known)
  cost: number;       // estimated USD cost
  fetchedAt: number;  // timestamp
}

export async function fetchOpenAIUsage(apiKey: string): Promise<TokenUsage>
```
- Call `https://api.openai.com/v1/usage?date=YYYY-MM-DD` with `Authorization: Bearer ${apiKey}`
- Map response to `TokenUsage`
- On error, throw with a descriptive message

**Create `src/extension/api/providers/AnthropicProvider.ts`**:
- Anthropic has no public usage endpoint; return an estimated `TokenUsage` based on `aiGenerated` character count
- Rough estimate: 1 token ≈ 4 characters; Claude Sonnet ≈ $3/M input tokens
- Mark `provider: 'anthropic'` and `limit: -1` (unknown)

**Create `src/extension/api/TokenPoller.ts`**:
- Constructor accepts `StateManager`, `SecretManager`
- `start()`: runs `setInterval` every 5 minutes
- On each tick: read API key from `SecretManager`, call the right provider, write result to `StateManager` under key `wai.tokenUsage`
- `stop()`: calls `clearInterval`
- Wrap all API calls in try-catch; log errors to output channel but never crash

**Wire into `src/extension/extension.ts`**:
- After restoring stats, check if any API key is stored (`secretManager.getApiKey('openai')`)
- If yes, instantiate `TokenPoller` and call `start()`
- Add to `context.subscriptions` via `{ dispose: () => poller.stop() }`
- Also push token usage into `DashboardPanel` when posting stats

**Update `src/webview/App.tsx`**:
- Listen for `message.type === 'tokenUsageUpdate'`
- Store in state: `const [tokenUsage, setTokenUsage] = useState(null)`
- Render `<RateLimitBar usage={tokenUsage.used / tokenUsage.limit} label={tokenUsage.provider} />` when `tokenUsage` is available and `limit > 0`

---

## Acceptance Criteria

- [ ] Status bar shows `$(wand) AI XX%` within 2 seconds of typing
- [ ] Clicking status bar opens the dashboard
- [ ] `MetricsSummary` shows "AI Lines" and "Human Lines" as primary hero cards
- [ ] All existing data migrates safely — no crashes if old fields are missing
- [ ] `dailyHistory` array has one entry per unique day, capped at 30
- [ ] `byLanguage` shows entries for each language with correct AI/human split
- [ ] `wai.inputApiKey` → select OpenAI → enter key → key survives VS Code restart
- [ ] `RateLimitBar` renders green/yellow/red when token data is available
- [ ] Build passes: `npm run compile`
- [ ] Commit and push to GitHub when complete

## Build & Test

```bash
npm run compile      # must succeed with no errors
npm run watch        # use during development
```

Press F5 in VS Code (or install the .vsix in Antigravity) to test interactively.
