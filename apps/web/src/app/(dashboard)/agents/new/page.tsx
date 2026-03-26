"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

const MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  ],
  anthropic: [
    { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
    { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
  ],
  google: [
    { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
  ],
};

export default function NewAgentPage() {
  const router = useRouter();
  const createAgent = trpc.agents.create.useMutation({
    onSuccess: (agent) => router.push(`/agents/${agent.id}`),
  });

  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [model, setModel] = useState("gpt-4o");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");

  function handleProviderChange(p: typeof provider) {
    setProvider(p);
    setModel(MODELS[p][0].value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createAgent.mutateAsync({
      name,
      description: description || undefined,
      systemPrompt,
      model,
      provider,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Create Agent</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
            maxLength={100}
            placeholder="My Agent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            maxLength={500}
            placeholder="What does this agent do?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as typeof provider)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {MODELS[provider].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            maxLength={10000}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createAgent.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createAgent.isPending ? "Creating..." : "Create Agent"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>

        {createAgent.error && (
          <p className="text-sm text-red-600">{createAgent.error.message}</p>
        )}
      </form>
    </div>
  );
}
