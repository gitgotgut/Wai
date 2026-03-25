import { useState } from "react";

interface DailySnapshot {
  date: string;
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

interface ActivityChartProps {
  dailyHistory: DailySnapshot[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return DAY_LABELS[d.getDay()];
}

export function ActivityChart({ dailyHistory }: ActivityChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const last7 = dailyHistory.slice(-7);

  if (last7.length < 2) {
    return (
      <section className="activity-chart">
        <h2>7-Day Activity</h2>
        <p style={{ color: "var(--vscode-descriptionForeground)", fontSize: "0.9em" }}>
          Keep coding — your chart will appear after a couple of days.
        </p>
      </section>
    );
  }

  const maxLines = Math.max(...last7.map((d) => d.aiLinesGenerated + d.humanLinesTyped), 1);

  // SVG layout constants
  const svgWidth = 320;
  const svgHeight = 160;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 28;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;
  const barCount = last7.length;
  const barGap = 6;
  const barW = (chartW - barGap * (barCount - 1)) / barCount;

  const gridFractions = [0.25, 0.5, 0.75];

  return (
    <section className="activity-chart">
      <h2>7-Day Activity</h2>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: "block", overflow: "visible" }}
        aria-label="7-day coding activity chart"
      >
        {/* Gridlines */}
        {gridFractions.map((frac) => {
          const y = padTop + chartH * (1 - frac);
          return (
            <g key={frac}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="var(--vscode-editorWidget-border, #444)"
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="var(--vscode-descriptionForeground, #888)"
              >
                {Math.round(maxLines * frac)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {last7.map((day, i) => {
          const x = padLeft + i * (barW + barGap);
          const totalLines = day.aiLinesGenerated + day.humanLinesTyped;
          const humanH = totalLines > 0 ? (day.humanLinesTyped / maxLines) * chartH : 0;
          const aiH = totalLines > 0 ? (day.aiLinesGenerated / maxLines) * chartH : 0;
          const humanY = padTop + chartH - humanH;
          const aiY = humanY - aiH;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={day.date}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "default" }}
            >
              {/* Human bar */}
              {humanH > 0 && (
                <rect
                  x={x}
                  y={humanY}
                  width={barW}
                  height={humanH}
                  fill="#6e6e6e"
                  opacity={isHovered ? 1 : 0.85}
                />
              )}
              {/* AI bar */}
              {aiH > 0 && (
                <rect
                  x={x}
                  y={aiY}
                  width={barW}
                  height={aiH}
                  fill="var(--vscode-textLink-foreground, #3794ff)"
                  opacity={isHovered ? 1 : 0.85}
                />
              )}
              {/* Zero-height placeholder so hover still works */}
              {totalLines === 0 && (
                <rect x={x} y={padTop + chartH - 2} width={barW} height={2} fill="#333" opacity={0.3} />
              )}
              {/* Day label */}
              <text
                x={x + barW / 2}
                y={padTop + chartH + 14}
                textAnchor="middle"
                fontSize={10}
                fill="var(--vscode-descriptionForeground, #888)"
              >
                {getDayLabel(day.date)}
              </text>

              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={Math.min(x, padLeft + chartW - 90)}
                    y={Math.max(aiY - 42, padTop)}
                    width={88}
                    height={38}
                    rx={4}
                    fill="var(--vscode-editorHoverWidget-background, #252526)"
                    stroke="var(--vscode-editorWidget-border, #454545)"
                    strokeWidth={1}
                  />
                  <text
                    x={Math.min(x, padLeft + chartW - 90) + 6}
                    y={Math.max(aiY - 42, padTop) + 14}
                    fontSize={10}
                    fill="var(--vscode-textLink-foreground, #3794ff)"
                  >
                    AI: {day.aiLinesGenerated} lines
                  </text>
                  <text
                    x={Math.min(x, padLeft + chartW - 90) + 6}
                    y={Math.max(aiY - 42, padTop) + 28}
                    fontSize={10}
                    fill="var(--vscode-foreground, #ccc)"
                  >
                    Human: {day.humanLinesTyped} lines
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Y-axis baseline */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + chartH}
          stroke="var(--vscode-editorWidget-border, #444)"
          strokeWidth={1}
        />
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={padLeft + chartW}
          y2={padTop + chartH}
          stroke="var(--vscode-editorWidget-border, #444)"
          strokeWidth={1}
        />
      </svg>
    </section>
  );
}
