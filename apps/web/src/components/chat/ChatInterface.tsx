"use client";

import { useChat } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef } from "react";

interface ChatInterfaceProps {
  agentId: string;
  conversationId?: string;
  initialMessages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export function ChatInterface({ agentId, conversationId, initialMessages }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
    body: { agentId, conversationId },
    initialMessages,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-20 text-center text-gray-400">
            Send a message to start the conversation.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role as "user" | "assistant"} content={m.content} />
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-800">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error.message}
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 resize-none rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
