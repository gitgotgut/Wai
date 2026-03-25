import { ChangeType, type ClassificationResult } from "../heuristics/ChangeClassifier";

export interface ChangeEvent {
  type: ChangeType;
  confidence: number;
  characterCount: number;
  lineCount: number;
  timestamp: number;
  languageId: string;
}

export interface DailySnapshot {
  date: string;
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

export interface LanguageStats {
  ai: number;
  human: number;
  aiLines: number;
  humanLines: number;
}

export interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
  aiLinesGenerated: number;
  humanLinesTyped: number;
  dailyHistory: DailySnapshot[];
  byLanguage: Record<string, LanguageStats>;
}

export interface FlushResult {
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  humanLinesTyped: number;
  aiLinesGenerated: number;
  byLanguage: Record<string, LanguageStats>;
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
    aiLinesGenerated: 0,
    humanLinesTyped: 0,
    dailyHistory: [],
    byLanguage: {},
  };
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

/**
 * In-memory buffer that accumulates change events for the current session.
 * Periodically flushed to persistent storage by SessionTracker.
 */
export class EventCollector {
  private events: ChangeEvent[] = [];

  recordChange(classification: ClassificationResult, languageId: string, text: string): void {
    this.events.push({
      type: classification.type,
      confidence: classification.confidence,
      characterCount: classification.characterCount,
      lineCount: countLines(text),
      timestamp: Date.now(),
      languageId,
    });
  }

  /** Compute aggregate stats for all buffered events, then clear the buffer. */
  flush(): FlushResult {
    let humanTyping = 0;
    let aiGenerated = 0;
    let pastes = 0;
    let humanLinesTyped = 0;
    let aiLinesGenerated = 0;
    const byLanguage: Record<string, LanguageStats> = {};

    for (const e of this.events) {
      // Ensure per-language bucket exists
      if (!byLanguage[e.languageId]) {
        byLanguage[e.languageId] = { ai: 0, human: 0, aiLines: 0, humanLines: 0 };
      }
      const lang = byLanguage[e.languageId];

      switch (e.type) {
        case ChangeType.HUMAN_TYPING:
          humanTyping += e.characterCount;
          humanLinesTyped += e.lineCount;
          lang.human += e.characterCount;
          lang.humanLines += e.lineCount;
          break;
        case ChangeType.AI_GENERATED:
          aiGenerated += e.characterCount;
          aiLinesGenerated += e.lineCount;
          lang.ai += e.characterCount;
          lang.aiLines += e.lineCount;
          break;
        case ChangeType.PASTE:
          pastes += e.characterCount;
          break;
      }
    }

    this.events = [];
    return { humanTyping, aiGenerated, pastes, humanLinesTyped, aiLinesGenerated, byLanguage };
  }

  get eventCount(): number {
    return this.events.length;
  }
}
