import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Link
        href="/settings/api-keys"
        className="flex items-center justify-between rounded-lg border border-gray-200 p-5 transition hover:border-blue-400 hover:shadow-sm dark:border-gray-800 dark:hover:border-blue-600"
      >
        <div>
          <h2 className="font-semibold">API Keys</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your OpenAI, Anthropic, and Google API keys for agent usage.
          </p>
        </div>
        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
