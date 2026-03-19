import { StateManager } from "../storage/StateManager";
import { EventCollector, emptyStats, type SessionStats } from "./EventCollector";

const STORAGE_KEY = "wai.stats";

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
    this.allTime.sessions += 1;
  }

  /** Flush in-memory events into all-time stats and persist to globalState. */
  async persist(): Promise<void> {
    const delta = this.collector.flush();

    this.allTime.humanTyping += delta.humanTyping;
    this.allTime.aiGenerated += delta.aiGenerated;
    this.allTime.pastes += delta.pastes;

    const today = new Date().toISOString().split("T")[0];
    if (!this.allTime.uniqueDaysActive.includes(today)) {
      this.allTime.uniqueDaysActive.push(today);
    }

    await this.state.setGlobalState(STORAGE_KEY, this.allTime);
  }

  /** Reset all accumulated statistics. */
  async reset(): Promise<void> {
    this.collector.flush();
    this.allTime = emptyStats();
    await this.state.setGlobalState(STORAGE_KEY, this.allTime);
  }

  /** Return a snapshot of the current all-time stats (includes un-flushed delta). */
  getStats(): SessionStats {
    return { ...this.allTime };
  }
}
