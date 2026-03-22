import { useEffect, useState } from "react";
import { useVSCodeAPI } from "./hooks/useVSCodeAPI";
import { MetricsSummary } from "./components/MetricsSummary";
import { LanguageBreakdown } from "./components/LanguageBreakdown";
import { RateLimitBar } from "./components/RateLimitBar";
import { ActivityChart } from "./components/ActivityChart";

interface DailySnapshot {
  date: string;
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

interface LanguageStats {
  ai: number;
  human: number;
  aiLines: number;
  humanLines: number;
}

interface TokenUsage {
  provider: string;
  used: number;
  limit: number;
  cost: number;
  fetchedAt: number;
}

interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
  aiLinesGenerated?: number;
  humanLinesTyped?: number;
  dailyHistory?: DailySnapshot[];
  byLanguage?: Record<string, LanguageStats>;
}

export function App() {
  const vscode = useVSCodeAPI();
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  useEffect(() => {
    vscode.postMessage({ command: "getStats" });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "statsUpdate") {
        setStats(msg.payload);
      } else if (msg.type === "tokenUsageUpdate") {
        setTokenUsage(msg.payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="dashboard">
      <h1>Wai Analytics</h1>
      <MetricsSummary stats={stats} />
      <LanguageBreakdown byLanguage={stats?.byLanguage} />

      {tokenUsage && tokenUsage.limit > 0 && (
        <RateLimitBar
          usage={tokenUsage.used / tokenUsage.limit}
          label={`${tokenUsage.provider} — $${tokenUsage.cost.toFixed(2)} est.`}
        />
      )}

      {tokenUsage && tokenUsage.limit <= 0 && (
        <div className="token-estimate">
          <span>{tokenUsage.provider}: ~${tokenUsage.cost.toFixed(2)} estimated cost today</span>
        </div>
      )}

      <ActivityChart dailyHistory={stats?.dailyHistory ?? []} />
    </main>
  );
}
