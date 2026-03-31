"use client";

import { trpc } from "@/lib/trpc";
import { formatCost } from "@/lib/cost";

export function UsageChart() {
  const { data = [], isLoading } = trpc.usage.daily.useQuery({ days: 30 });

  const maxCost = Math.max(...data.map((d) => d.cost), 0.0001);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold">Daily Spend (Last 30 Days)</h2>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-gray-400">
          No usage data yet.
        </div>
      ) : (
        <div className="flex h-48 items-end gap-1">
          {data.map((d) => {
            const heightPct = (d.cost / maxCost) * 100;
            return (
              <div
                key={d.date}
                className="group relative flex flex-1 flex-col items-center"
              >
                <div
                  className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-400"
                  style={{ height: `${heightPct}%`, minHeight: d.cost > 0 ? "2px" : "0" }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                  <div>{d.date}</div>
                  <div>{formatCost(d.cost)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
