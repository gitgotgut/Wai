import { StateManager } from "../storage/StateManager";
import { EventCollector, emptyStats, type SessionStats, type DailySnapshot, type LanguageStats } from "./EventCollector";

const STORAGE_KEY = "wai.stats";
const MAX_DAILY_HISTORY = 30;

/**
 * Merges the in-memory event buffer into persistent all-time statistics.
 * Performs a periodic flush (every 30 s) and a final flush on deactivation.
 */
export class SessionTracker {
  private allTime: SessionStats;

  constructor(
    private readonly state: StateManager,
    private readonly collector: EventCollector,
  ) {
    this.allTime = emptyStats();
  }

  /** Restore previously persisted stats (call once at activation). */
  async restore(): Promise<void> {
    const saved = await this.state.getGlobalState<SessionStats>(STORAGE_KEY);
    if (saved) {
      this.allTime = saved;
    }
    // Migrate fields that may be absent from older versions
    this.allTime.aiLinesGenerated ??= 0;
    this.allTime.humanLinesTyped ??= 0;
    this.allTime.dailyHistory ??= [];
    this.allTime.byLanguage ??= {};

    this.allTime.sessions += 1;
  }

  /** Flush in-memory events into all-time stats and persist to globalState. */
  async persist(): Promise<void> {
    const delta = this.collector.flush();

    // ── Accumulate totals ───────────────────────────────────────────
    this.allTime.humanTyping += delta.humanTyping;
    this.allTime.aiGenerated += delta.aiGenerated;
    this.allTime.pastes += delta.pastes;
    this.allTime.humanLinesTyped += delta.humanLinesTyped;
    this.allTime.aiLinesGenerated += delta.aiLinesGenerated;

    // ── Unique days ─────────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    if (!this.allTime.uniqueDaysActive.includes(today)) {
      this.allTime.uniqueDaysActive.push(today);
    }

    // ── Daily history (upsert today's snapshot) ─────────────────────
    this.upsertDailySnapshot(today, delta);

    // ── Per-language merge ──────────────────────────────────────────
    for (const [lang, langDelta] of Object.entries(delta.byLanguage)) {
      if (!this.allTime.byLanguage[lang]) {
        this.allTime.byLanguage[lang] = { ai: 0, human: 0, aiLines: 0, humanLines: 0 };
      }
      const existing = this.allTime.byLanguage[lang];
      existing.ai += langDelta.ai;
      existing.human += langDelta.human;
      existing.aiLines += langDelta.aiLines;
      existing.humanLines += langDelta.humanLines;
    }

    await this.state.setGlobalState(STORAGE_KEY, this.allTime);
  }

  /** Reset all accumulated statistics. */
  async reset(): Promise<void> {
    this.collector.flush();
    this.allTime = emptyStats();
    await this.state.setGlobalState(STORAGE_KEY, this.allTime);
  }

  /** Return a snapshot of the current all-time stats. */
  getStats(): SessionStats {
    return { ...this.allTime };
  }

  // ── Private ─────────────────────────────────────────────────────────

  private upsertDailySnapshot(today: string, delta: { aiGenerated: number; humanTyping: number; pastes: number; aiLinesGenerated: number; humanLinesTyped: number }): void {
    const existing = this.allTime.dailyHistory.find((s) => s.date === today);
    if (existing) {
      existing.aiGenerated += delta.aiGenerated;
      existing.humanTyping += delta.humanTyping;
      existing.pastes += delta.pastes;
      existing.aiLinesGenerated += delta.aiLinesGenerated;
      existing.humanLinesTyped += delta.humanLinesTyped;
    } else {
      this.allTime.dailyHistory.push({
        date: today,
        aiGenerated: delta.aiGenerated,
        humanTyping: delta.humanTyping,
        pastes: delta.pastes,
        aiLinesGenerated: delta.aiLinesGenerated,
        humanLinesTyped: delta.humanLinesTyped,
      });
    }

    // Trim to last N days
    if (this.allTime.dailyHistory.length > MAX_DAILY_HISTORY) {
      this.allTime.dailyHistory = this.allTime.dailyHistory.slice(-MAX_DAILY_HISTORY);
    }
  }
}
