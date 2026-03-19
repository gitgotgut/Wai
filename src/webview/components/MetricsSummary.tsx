import React from "react";

interface SessionStats {
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
}

interface MetricsSummaryProps {
  stats: SessionStats | null;
}

function formatChars(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function pct(part: number, total: number): string {
  if (total === 0) return "0";
  return ((part / total) * 100).toFixed(1);
}

export function MetricsSummary({ stats }: MetricsSummaryProps) {
  if (!stats) {
    return <p className="loading">Collecting data...</p>;
  }

  const total = stats.humanTyping + stats.aiGenerated + stats.pastes;
  const aiRate = pct(stats.aiGenerated, stats.humanTyping + stats.aiGenerated);

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-value">{formatChars(stats.aiGenerated)}</span>
        <span className="metric-label">AI Characters</span>
      </div>

      <div className="metric-card">
        <span className="metric-value">{formatChars(stats.humanTyping)}</span>
        <span className="metric-label">Human Characters</span>
      </div>

      <div className="metric-card">
        <span className="metric-value">{aiRate}%</span>
        <span className="metric-label">AI Rate</span>
      </div>

      <div className="metric-card">
        <span className="metric-value">{formatChars(stats.pastes)}</span>
        <span className="metric-label">Pasted Characters</span>
      </div>

      <div className="metric-card">
        <span className="metric-value">{stats.sessions}</span>
        <span className="metric-label">Sessions</span>
      </div>

      <div className="metric-card">
        <span className="metric-value">{stats.uniqueDaysActive.length}</span>
        <span className="metric-label">Active Days</span>
      </div>

      <div className="metric-card full-width">
        <span className="metric-value">{formatChars(total)}</span>
        <span className="metric-label">Total Characters Tracked</span>
      </div>
    </div>
  );
}
