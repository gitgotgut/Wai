import React from "react";

interface LanguageStats {
  ai: number;
  human: number;
  aiLines: number;
  humanLines: number;
}

interface LanguageBreakdownProps {
  byLanguage?: Record<string, LanguageStats>;
}

export function LanguageBreakdown({ byLanguage }: LanguageBreakdownProps) {
  if (!byLanguage) return null;

  const entries = Object.entries(byLanguage)
    .map(([lang, s]) => ({ lang, total: s.ai + s.human, ...s }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (entries.length === 0) return null;

  return (
    <section className="language-breakdown">
      <h2>Top Languages</h2>
      <ul className="lang-list">
        {entries.map((e) => {
          const aiPct = e.total > 0 ? (e.ai / e.total) * 100 : 0;
          return (
            <li key={e.lang} className="lang-row">
              <span className="lang-name">{e.lang}</span>
              <div className="lang-bar-track">
                <div className="lang-bar-ai" style={{ width: `${aiPct}%` }} />
              </div>
              <span className="lang-stat">
                {e.aiLines + e.humanLines} lines
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
