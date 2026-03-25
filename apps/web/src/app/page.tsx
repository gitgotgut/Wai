import Link from "next/link";

const features = [
  {
    title: "AI Analytics",
    description: "Track how much code you generate with AI vs. writing manually. See acceptance rates, token consumption, and time savings.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    title: "AI Agents",
    description: "Create dedicated AI agents for development, marketing, research, and more. Configure system prompts, models, and tools.",
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "Bring Your Own Key",
    description: "Use your own API keys for OpenAI, Anthropic, and Google. Your keys are encrypted at rest with AES-256-GCM.",
    icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
  },
  {
    title: "Extension Sync",
    description: "Connect your VS Code extension to sync local coding analytics to the cloud. View everything in one unified dashboard.",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
        <span className="text-xl font-bold">Wai</span>
        <Link
          href="/login"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          AI Usage Analytics &amp; Agent Platform
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-400">
          Track your AI coding patterns. Create dedicated AI agents. Control your costs.
        </p>
        <Link
          href="/login"
          className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Get Started
        </Link>
      </main>

      {/* Features */}
      <section className="border-t px-6 py-20 dark:border-gray-800">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border p-6 dark:border-gray-800">
              <svg className="mb-3 h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
              </svg>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-gray-500 dark:border-gray-800">
        Wai Platform &mdash; Open Source on{" "}
        <a href="https://github.com/gitgotgut/Wai" className="underline hover:text-gray-700 dark:hover:text-gray-300">
          GitHub
        </a>
      </footer>
    </div>
  );
}
