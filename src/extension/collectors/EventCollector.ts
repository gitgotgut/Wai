import { ChangeType, type ClassificationResult } from "../heuristics/ChangeClassifier";

export interface ChangeEvent {
  type: ChangeType;
  confidence: number;
  characterCount: number;
  timestamp: number;
  languageId: string;
}

export interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
}

export function emptyStats(): SessionStats {
  return {
    startTime: Date.now(),
    humanTyping: 0,
    aiGenerated: 0,
    pastes: 0,
    sessions: 0,
    uniqueDaysActive: [],
    commandUsageCount: {},
  };
}

/**
 * In-memory buffer that accumulates change events for the current session.
 * Periodically flushed to persistent storage by SessionTracker.
 */
export class EventCollector {
  private events: ChangeEvent[] = [];
  private readonly sessionStart = Date.now();

  recordChange(classification: ClassificationResult, languageId: string): void {
    this.events.push({
      type: classification.type,
      confidence: classification.confidence,
      characterCount: classification.characterCount,
      timestamp: Date.now(),
      languageId,
    });
  }

  /** Compute aggregate stats for all buffered events, then clear the buffer. */
  flush(): { humanTyping: number; aiGenerated: number; pastes: number } {
    let humanTyping = 0;
    let aiGenerated = 0;
    let pastes = 0;

    for (const e of this.events) {
      switch (e.type) {
        case ChangeType.HUMAN_TYPING:
          humanTyping += e.characterCount;
          break;
        case ChangeType.AI_GENERATED:
          aiGenerated += e.characterCount;
          break;
        case ChangeType.PASTE:
          pastes += e.characterCount;
          break;
      }
    }

    this.events = [];
    return { humanTyping, aiGenerated, pastes };
  }

  get eventCount(): number {
    return this.events.length;
  }
}
