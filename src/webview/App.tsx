import React, { useEffect, useState } from "react";
import { useVSCodeAPI } from "./hooks/useVSCodeAPI";
import { MetricsSummary } from "./components/MetricsSummary";
import { ActivityChart } from "./components/ActivityChart";

interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
}

export function App() {
  const vscode = useVSCodeAPI();
  const [stats, setStats] = useState<SessionStats | null>(null);

  useEffect(() => {
    // Request initial data from extension
    vscode.postMessage({ command: "getStats" });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "statsUpdate") {
        setStats(msg.payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="dashboard">
      <h1>Wai Analytics</h1>
      <MetricsSummary stats={stats} />
      <ActivityChart />
    </main>
  );
}
