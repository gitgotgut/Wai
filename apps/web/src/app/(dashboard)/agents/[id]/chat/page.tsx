"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { ChatInterface } from "@/components/chat/ChatInterface";
import Link from "next/link";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const { data: agent, isLoading } = trpc.agents.get.useQuery({ id: params.id });
  const { data: convos } = trpc.conversations.list.useQuery({ agentId: params.id });

  if (isLoading) return <p className="p-4 text-sm text-gray-500">Loading agent...</p>;
  if (!agent) return <p className="p-4 text-sm text-gray-500">Agent not found.</p>;

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      {/* Conversation sidebar */}
      <aside className="hidden w-56 flex-col border-r dark:border-gray-800 md:flex">
        <div className="flex items-center justify-between border-b p-3 dark:border-gray-800">
          <Link href={`/agents/${params.id}`} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            &larr; {agent.name}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 py-1 text-xs font-medium uppercase text-gray-400">Conversations</p>
          {(!convos || convos.length === 0) && (
            <p className="px-2 py-3 text-xs text-gray-400">None yet</p>
          )}
          {convos?.map((c) => (
            <div key={c.id} className="truncate rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              {c.title}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1">
        <ChatInterface agentId={params.id} />
      </div>
    </div>
  );
}
