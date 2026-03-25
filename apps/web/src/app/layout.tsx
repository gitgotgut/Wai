import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wai — AI Usage Analytics & Agent Platform",
    template: "%s | Wai",
  },
  description:
    "Track your AI coding patterns. Create dedicated AI agents. Control your costs. BYOK supported.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
