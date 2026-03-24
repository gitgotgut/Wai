# Wai Platform — Claude Planning & Development Prompt

> Copy everything below the line into a new Claude conversation.

---

## System Context

You are helping me plan and build **Wai Platform** — an online SaaS that extends my existing VS Code extension (Wai) into a full-stack web platform for AI usage analytics and dedicated AI agent management.

### What Already Exists

I have a working VS Code extension called **Wai** (`https://github.com/gitgotgut/Wai`) that:

- **Tracks AI vs. human code** — monitors text changes in the editor and classifies them as AI-generated, human-typed, or pasted using heuristic algorithms (size-based + Tab-accept detection for Copilot completions)
- **Stores everything locally** — in-memory event buffering with periodic sync to VS Code `globalState`, API keys in OS credential manager via `SecretStorage`
- **Shows a real-time dashboard** — React webview inside VS Code with:
  - AI rate status bar indicator (`AI 67%`)
  - Lines of code metrics (AI vs. human)
  - Per-language breakdown (top 5 languages by activity)
  - 7-day SVG activity chart (stacked bars, no external charting libs)
  - API cost tracking (OpenAI usage polling, Anthropic estimation)
  - Weekly digest notification (Monday summary)
  - Export to CSV/JSON

**Tech stack**: TypeScript, React 18 (functional components + hooks), esbuild (dual-bundle: Node extension + browser webview), VS Code Extension API.

**Data model** (current):
```typescript
interface SessionStats {
  startTime: number;
  humanTyping: number;          // character count
  aiGenerated: number;          // character count
  pastes: number;               // character count
  sessions: number;
  uniqueDaysActive: string[];
  aiLinesGenerated: number;
  humanLinesTyped: number;
  dailyHistory: DailySnapshot[];  // 30-day rolling
  byLanguage: Record<string, { ai: number; human: number; aiLines: number; humanLines: number }>;
  commandUsageCount: { [command: string]: number };
  totalTokensUsed?: number;
  apiCostEstimate?: number;
}

interface DailySnapshot {
  date: string;              // "YYYY-MM-DD"
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

interface ChangeEvent {
  type: 'human' | 'ai' | 'paste' | 'unknown';
  confidence: number;        // 0.0-1.0
  characterCount: number;
  timestamp: number;
  languageId: string;
}
```

**Key source files** (21 total in `src/`):
```
src/extension/extension.ts              - entry point
src/extension/heuristics/ChangeClassifier.ts  - AI vs human classification
src/extension/heuristics/TabAcceptTracker.ts  - Copilot Tab-accept detection
src/extension/collectors/EventCollector.ts    - in-memory buffering
src/extension/collectors/SessionTracker.ts    - persistence + aggregation
src/extension/storage/StateManager.ts         - VS Code globalState wrapper
src/extension/storage/SecretManager.ts        - API key storage
src/extension/api/TokenPoller.ts              - background API usage polling
src/extension/api/providers/OpenAIProvider.ts
src/extension/api/providers/AnthropicProvider.ts
src/extension/ui/StatusBarController.ts       - status bar AI %
src/extension/ui/DigestNotifier.ts            - weekly digest
src/extension/exporters/StatsExporter.ts      - CSV/JSON export
src/extension/webview/DashboardPanel.ts       - webview lifecycle
src/webview/App.tsx                           - React root
src/webview/components/MetricsSummary.tsx
src/webview/components/ActivityChart.tsx
src/webview/components/LanguageBreakdown.tsx
src/webview/components/RateLimitBar.tsx
src/webview/hooks/useVSCodeAPI.ts
src/webview/index.tsx
```

---

## What I Want to Build

Transform Wai from a local VS Code extension into an **online platform** with these capabilities:

### 1. AI Agent Hub
Create and manage **dedicated AI agents** for different use cases:

- **Software Development Agent** — code generation, review, debugging assistance
- **Marketing Agent** — copy generation, campaign ideation, A/B test suggestions
- **Research Agent** — literature review, summarisation, competitive analysis
- **Custom Agents** — user-defined agents with custom system prompts, tool access, and model selection

Each agent should have:
- A configurable system prompt and personality
- Model selection (GPT-4o, Claude Sonnet/Opus, Gemini, Llama, etc.)
- Context/knowledge base (upload docs, connect repos, paste URLs)
- Tool access configuration (web search, code execution, file management)
- Conversation history with full thread management
- Sharing — agents can be shared with team members or published to a marketplace

### 2. Unified AI Usage Analytics (extending what Wai already tracks)
- **Cross-tool tracking** — track AI usage not just in the IDE but across all platform agents
- **Cost dashboard** — real-time spend across all AI providers (OpenAI, Anthropic, Google, etc.) in one view
- **Per-agent analytics** — which agents are generating the most value? Token spend per agent, per user, per team
- **ROI metrics** — estimate time saved, lines of code generated, cost per productive output
- **Team rollups** — aggregate analytics across team members (manager view)
- **Budget controls** — set spend limits per agent, per user, per team, per month
- **Usage alerts** — notify when approaching limits, unusual spend spikes, etc.

### 3. IDE Extension Sync
- **Cloud sync** for the existing VS Code extension data — opt-in, end-to-end encrypted
- Push local `SessionStats` to the platform for cross-device analytics
- The extension becomes a data source feeding into the platform dashboard
- Two-way: platform can push agent configurations down to the IDE

### 4. Team & Organisation Features
- **Workspaces** — isolated environments for teams/orgs
- **Role-based access** — Owner, Admin, Member, Viewer
- **Invite system** — email invites, link invites, SSO (Google, GitHub, Microsoft)
- **Team analytics** — who is using AI most effectively? Anonymous benchmarks optional
- **Audit log** — who created/modified agents, who accessed what data

---

## Your Task

Help me plan and develop this platform. I need you to:

### Phase A: Architecture & Planning
1. **Choose the tech stack** — recommend a modern, scalable stack for the web platform. Consider:
   - Frontend framework (Next.js? SvelteKit? Remix?)
   - Backend/API layer (Node.js? Go? Edge functions?)
   - Database (Postgres? PlanetScale? Supabase?)
   - Auth (Clerk? NextAuth? Supabase Auth?)
   - Real-time (WebSockets? SSE? Supabase Realtime?)
   - AI provider abstraction (Vercel AI SDK? LangChain? Custom?)
   - Hosting/infra (Vercel? Railway? Fly.io? AWS?)
   - Payments (Stripe)

2. **Design the data model** — extend the existing Wai data model for multi-user, multi-agent, multi-provider scenarios. Key entities:
   - User, Workspace, Team, Membership
   - Agent (config, system prompt, model, tools, knowledge base)
   - Conversation, Message, Thread
   - UsageRecord (tokens in/out, cost, provider, agent, user, timestamp)
   - Budget, Alert, AuditLog
   - ExtensionSync (push/pull state between IDE and platform)

3. **Define the API** — what endpoints/mutations are needed? Consider:
   - REST vs. GraphQL vs. tRPC
   - Real-time subscriptions for live cost tracking
   - Streaming for agent responses
   - Webhook endpoints for IDE sync
   - Rate limiting strategy

4. **Design the security model**:
   - How are API keys for AI providers stored? (per-user? per-workspace?)
   - End-to-end encryption for synced IDE data
   - Row-level security for multi-tenant data
   - CSP, CORS, CSRF protections
   - SOC 2 readiness considerations

### Phase B: MVP Scope (what to build first)
Define a realistic MVP that delivers value quickly:
- Core agent creation + chat interface
- Basic usage tracking dashboard
- Single-user (team features come later)
- One or two AI providers (OpenAI + Anthropic)
- Simple cost tracking
- Extension sync (basic push)

### Phase C: Implementation Plan
For the MVP, provide:
- Directory/file structure for the new platform codebase
- Database schema (SQL or ORM model definitions)
- Key API routes with request/response shapes
- Frontend page structure and component hierarchy
- Authentication flow
- AI chat streaming implementation
- Step-by-step build order (what to implement first, second, etc.)

### Phase D: Extension Integration
How to modify the existing Wai VS Code extension to:
- Add an opt-in "Sync to Wai Platform" setting
- Authenticate with the platform (OAuth device flow or token-based)
- Push `SessionStats` on a schedule (e.g., hourly)
- Pull agent configurations from the platform
- Show platform dashboard link in the extension

---

## Constraints & Preferences

- **Privacy-first** — the local-only option must always exist. Cloud sync is opt-in.
- **Monorepo** — I want the platform and extension in the same repo (or a connected monorepo setup). The existing extension is at `https://github.com/gitgotgut/Wai`.
- **TypeScript everywhere** — frontend, backend, shared types.
- **Modern stack** — I want something that is fast to develop with, well-documented, and has good DX.
- **Start small** — do not overengineer. MVP first, then iterate.
- **Cost-conscious** — recommend hosting/services that are free or cheap for early stage, but can scale.
- **Production-quality code** — no shortcuts. Proper error handling, types, tests, logging.

---

## Deliverables I Expect

1. **Architecture document** — tech stack decisions with rationale
2. **Data model** — full schema with relationships
3. **API design** — endpoints, auth flow, streaming approach
4. **MVP scope** — explicitly what is in and what is deferred
5. **Implementation plan** — ordered list of files to create, with descriptions
6. **Extension integration spec** — how the existing extension connects to the platform

Start with the architecture document (Phase A), then ask me to confirm before proceeding to Phase B.
