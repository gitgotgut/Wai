"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: agent, isLoading } = trpc.agents.get.useQuery({ id: params.id });
  const utils = trpc.useUtils();
  const updateAgent = trpc.agents.update.useMutation({
    onSuccess: () => utils.agents.get.invalidate({ id: params.id }),
  });
  const deleteAgent = trpc.agents.delete.useMutation({
    onSuccess: () => router.push("/agents"),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description ?? "");
      setSystemPrompt(agent.systemPrompt);
      setProvider(agent.provider as "openai" | "anthropic" | "google");
      setModel(agent.model);
    }
  }, [agent]);

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!agent) return <p className="text-sm text-gray-500">Agent not found.</p>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateAgent.mutateAsync({
      id: params.id,
      name,
      description: description || undefined,
      systemPrompt,
      model,
      provider,
    });
  }

  function handleProviderChange(p: typeof provider) {
    setProvider(p);
    setModel(MODELS[p][0].value);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    await deleteAgent.mutateAsync({ id: params.id });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Agent</h1>
        <button
          onClick={() => router.push(`/agents/${params.id}/chat`)}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Open Chat
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
            maxLength={100}
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateAgent.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateAgent.isPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/agents")}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteAgent.isPending}
            className="ml-auto rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            Delete Agent
          </button>
        </div>

        {updateAgent.isSuccess && (
          <p className="text-sm text-green-600">Changes saved.</p>
        )}
        {updateAgent.error && (
          <p className="text-sm text-red-600">{updateAgent.error.message}</p>
        )}
      </form>
    </div>
  );
}
