"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

export default function AgentsPage() {
  const { data: agents, isLoading } = trpc.agents.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Agents</h1>
        <Link
          href="/agents/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Agent
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading agents...</p>}

      {agents?.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500">No agents yet. Create your first one to get started.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="group rounded-lg border border-gray-200 p-5 transition hover:border-blue-400 hover:shadow-sm dark:border-gray-800 dark:hover:border-blue-600"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold group-hover:text-blue-600">{agent.name}</h3>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${PROVIDER_COLORS[agent.provider] ?? "bg-gray-100 dark:bg-gray-800"}`}
              >
                {agent.provider}
              </span>
            </div>
            {agent.description && (
              <p className="mb-3 line-clamp-2 text-sm text-gray-500">{agent.description}</p>
            )}
            <p className="text-xs text-gray-400">{agent.model}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
