import React from "react";

interface SessionStats {
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  aiLinesGenerated?: number;
  humanLinesTyped?: number;
}

interface MetricsSummaryProps {
  stats: SessionStats | null;
}

function formatNum(n: number): string {
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

  const aiLines = stats.aiLinesGenerated ?? 0;
  const humanLines = stats.humanLinesTyped ?? 0;
  const lineTotal = aiLines + humanLines;
  const aiLineRate = pct(aiLines, lineTotal);

  const charTotal = stats.humanTyping + stats.aiGenerated + stats.pastes;

  return (
    <div className="metrics-grid">
      {/* Hero row — lines of code */}
      <div className="metric-card hero">
        <span className="metric-value">{formatNum(aiLines)}</span>
        <span className="metric-label">AI Lines</span>
      </div>

      <div className="metric-card hero">
        <span className="metric-value">{formatNum(humanLines)}</span>
        <span className="metric-label">Human Lines</span>
      </div>

      <div className="metric-card hero">
        <span className="metric-value">{aiLineRate}%</span>
        <span className="metric-label">AI Rate</span>
      </div>

      {/* Secondary row — characters & metadata */}
      <div className="metric-card">
        <span className="metric-value secondary">{formatNum(stats.aiGenerated)}</span>
        <span className="metric-label">AI Chars</span>
      </div>

      <div className="metric-card">
        <span className="metric-value secondary">{formatNum(stats.humanTyping)}</span>
        <span className="metric-label">Human Chars</span>
      </div>

      <div className="metric-card">
        <span className="metric-value secondary">{formatNum(stats.pastes)}</span>
        <span className="metric-label">Pasted Chars</span>
      </div>

      {/* Bottom row */}
      <div className="metric-card">
        <span className="metric-value secondary">{stats.sessions}</span>
        <span className="metric-label">Sessions</span>
      </div>

      <div className="metric-card">
        <span className="metric-value secondary">{stats.uniqueDaysActive.length}</span>
        <span className="metric-label">Active Days</span>
      </div>

      <div className="metric-card">
        <span className="metric-value secondary">{formatNum(charTotal)}</span>
        <span className="metric-label">Total Chars</span>
      </div>
    </div>
  );
}
