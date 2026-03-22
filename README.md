# Wai — AI Usage Analytics

Track how much of your code is AI-generated, monitor API token costs, and understand your coding patterns — all inside your IDE.

## Features

- **Live AI rate indicator** in the status bar (AI 67%)
- **Metrics dashboard** showing AI vs. human lines of code
- **Per-language breakdown** — where do you lean on AI most?
- **7-day activity chart** — visualise your coding patterns over time
- **API cost tracking** — monitor OpenAI/Anthropic spend in real time
- **Weekly digest** — Monday morning summary of last week's activity
- **Export to CSV/JSON** — for spreadsheets and team reporting

## How It Works

Wai monitors text changes in your editor and classifies them as AI-generated, human-typed, or pasted using a heuristic algorithm. No data leaves your machine — everything is stored locally via VS Code's built-in storage.

## Commands

| Command | Description |
|---------|-------------|
| `Wai: Open Dashboard` | Opens the analytics webview |
| `Wai: Set API Key` | Store an API key for token tracking |
| `Wai: Export Statistics` | Save your data as CSV or JSON |
| `Wai: Reset Statistics` | Clear all collected data |

## Privacy

All data stays on your machine. API keys are stored in your OS credential manager (never in plaintext). No telemetry is sent anywhere.
