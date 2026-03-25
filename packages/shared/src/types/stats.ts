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
  totalTokensUsed?: number;
  apiCostEstimate?: number;
}
