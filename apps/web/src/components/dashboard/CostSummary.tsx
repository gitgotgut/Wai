"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCost } from "@/lib/cost";

type Period = "7d" | "30d" | "all";

export function CostSummary() {
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isLoading } = trpc.usage.summary.useQuery({ period });

  const totalTokens = (data?.totalTokensIn ?? 0) + (data?.totalTokensOut ?? 0);
  const avgCost =
    data && data.messageCount > 0 ? data.totalCost / data.messageCount : 0;

  return (
    <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Summary</h2>
        <div className="flex gap-1 rounded-lg border p-1 text-sm dark:border-gray-700">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1 ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {p === "all" ? "All time" : `Last ${p}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Cost"
          value={isLoading ? "—" : formatCost(data?.totalCost ?? 0)}
        />
        <StatCard
          label="Total Tokens"
          value={isLoading ? "—" : totalTokens.toLocaleString()}
        />
        <StatCard
          label="Messages"
          value={isLoading ? "—" : (data?.messageCount ?? 0).toLocaleString()}
        />
        <StatCard
          label="Avg Cost / Msg"
          value={isLoading ? "—" : formatCost(avgCost)}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
