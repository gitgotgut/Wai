"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

export function RecentConversations() {
  const { data = [], isLoading } = trpc.usage.recentConversations.useQuery();

  return (
    <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold">Recent Conversations</h2>
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-gray-400">
          No conversations yet.{" "}
          <Link href="/agents" className="ml-1 text-blue-600 hover:underline">
            Start chatting with an agent.
          </Link>
        </div>
      ) : (
        <ul className="divide-y dark:divide-gray-800">
          {data.map((conv) => (
            <li key={conv.id} className="py-3">
              <Link
                href={`/agents/${conv.agentId}/chat?conversationId=${conv.id}`}
                className="flex items-start justify-between gap-4 hover:opacity-75"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{conv.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {conv.agentName}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
