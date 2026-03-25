import React from "react";

interface RateLimitBarProps {
  /** Current usage as a 0-1 fraction. */
  usage: number;
  label: string;
}

/**
 * Placeholder component for Phase 2 API rate limit display.
 * Renders a simple progress bar with color coding:
 *  - green  (< 60%)
 *  - yellow (60-85%)
 *  - red    (> 85%)
 */
export function RateLimitBar({ usage, label }: RateLimitBarProps) {
  const pct = Math.min(Math.max(usage, 0), 1) * 100;
  const color = pct > 85 ? "var(--bar-danger)" : pct > 60 ? "var(--bar-warning)" : "var(--bar-ok)";

  return (
    <div className="rate-limit">
      <div className="rate-limit-header">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="rate-limit-track">
        <div
          className="rate-limit-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
