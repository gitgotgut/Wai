"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ApiKeysPage() {
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.apiKeys.list.useQuery();
  const addKey = trpc.apiKeys.add.useMutation({ onSuccess: () => utils.apiKeys.list.invalidate() });
  const deleteKey = trpc.apiKeys.delete.useMutation({ onSuccess: () => utils.apiKeys.list.invalidate() });
  const testKey = trpc.apiKeys.test.useMutation();

  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("Default");
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addKey.mutateAsync({ provider, key, label });
    setKey("");
    setLabel("Default");
  }

  async function handleTest(id: string) {
    setTestResult((prev) => ({ ...prev, [id]: "testing..." }));
    try {
      await testKey.mutateAsync({ id });
      setTestResult((prev) => ({ ...prev, [id]: "valid" }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: "invalid" }));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">API Keys</h1>

      {/* Add key form */}
      <form onSubmit={handleAdd} className="space-y-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold">Add a new key</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              maxLength={50}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">API Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
            minLength={10}
          />
        </div>
        <button
          type="submit"
          disabled={addKey.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {addKey.isPending ? "Adding..." : "Add Key"}
        </button>
      </form>

      {/* Key list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your keys</h2>
        {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
        {keys?.length === 0 && <p className="text-sm text-gray-500">No API keys stored yet.</p>}
        {keys?.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase dark:bg-gray-800">
                  {k.provider}
                </span>
                <span className="text-sm font-medium">{k.label}</span>
              </div>
              <p className="font-mono text-xs text-gray-500">{k.maskedKey}</p>
            </div>
            <div className="flex items-center gap-2">
              {testResult[k.id] && (
                <span
                  className={`text-xs font-medium ${
                    testResult[k.id] === "valid"
                      ? "text-green-600"
                      : testResult[k.id] === "invalid"
                        ? "text-red-600"
                        : "text-gray-500"
                  }`}
                >
                  {testResult[k.id]}
                </span>
              )}
              <button
                onClick={() => handleTest(k.id)}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Test
              </button>
              <button
                onClick={() => deleteKey.mutate({ id: k.id })}
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
