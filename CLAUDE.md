# Wai: AI Usage Analytics for VS Code - Project Guidelines

**Project**: Wai VS Code Extension
**Purpose**: Track and analyze AI-assisted coding patterns, token consumption, and developer productivity
**Status**: Phase 1 (Data Collector & Analytics Foundation)

---

## Project Vision

Wai provides engineers with a comprehensive analytics suite to understand:
- How much code they generate with AI vs. writing manually
- Acceptance rates of AI suggestions
- Token consumption and API rate limits
- Time savings estimates

This starts with a VS Code extension that silently monitors coding patterns and surfaces actionable insights.

---

## Architecture Overview

```
Wai Extension = Data Collector (Node) + Data Visualizer (React)
     ↓
Event Interception (onDidChangeTextDocument)
     ↓
Heuristic Classification (AI vs human vs paste)
     ↓
Time-Series Storage (in-memory + periodic sync)
     ↓
WebView Dashboard (React) + Secure Secret Storage
```

---

## Core Design Decisions (Phase 1)

### 1. Heuristic Algorithm (No Copilot API Integration)
- **Why**: GitHub Copilot has no public API for integration
- **How**: Use observable text change patterns:
  - **AI Generation**: Large multi-line insertions (>15 chars + linebreak)
  - **Human Typing**: Single character keystrokes, small insertions
  - **Paste Detection**: >100 chars in <50ms elapsed time
- **Accuracy**: ~80-85% on typical development workflows
- **Caveat**: Some false positives (large AI completions on one line may be classified as pastes)

### 2. Paste Detection via Heuristics Only
- **Why**: Keybinding override (Ctrl+V) too risky for Phase 1 (breaks UX if extension crashes)
- **How**: Monitor insertion size and timestamp delta
  - If insertion >100 chars AND <50ms elapsed since last change → likely paste
  - Otherwise → classify with standard AI/human rules
- **Trade-off**: Accept ~15-20% false positives vs. zero UX risk

### 3. Dual-Bundle Build (esbuild)
- **Why**: Extension (Node) and Webview (Browser) have different environments
- **How**: Two separate esbuild configs:
  - Extension bundle: CJS, node target, externalizes vscode module
  - Webview bundle: IIFE, browser target, self-contained React app
- **Build Output**: `dist/extension.js` + `media/dashboard.js`

### 4. CSP-Compliant Webview
- **Why**: VS Code enforces strict Content Security Policy for security
- **How**:
  - Dynamic nonce generation at runtime
  - All inline scripts wrapped with `<script nonce="${nonce}">`
  - No external resource loading (fonts, CDNs, images)
  - Only `data:` URIs allowed for images
- **Benefit**: Immune to XSS attacks; safe to render user data

### 5. SecretStorage for API Keys
- **Why**: API keys must never be stored in plaintext
- **How**: Use VS Code's `SecretStorage` API
  - Abstracts over OS credential managers (Windows Credential Manager, macOS Keychain, Linux secret-tool)
  - Keys encrypted at rest
  - Never written to `settings.json` or logs
- **Interface**: `SecretManager.ts` provides high-level methods

### 6. In-Memory Event Buffering
- **Why**: Persisting every keystroke to disk = performance drag
- **How**:
  - Buffer text change events in memory during session
  - Periodically sync to storage (every 30s)
  - Final sync on extension deactivation
- **Benefit**: Fast responsiveness; no noticeable lag

### 7. Language Filtering
- **Why**: Extension shouldn't track changes in JSON, markdown, settings files
- **How**: Whitelist language IDs (javascript, typescript, python, java, cpp, go, rust)
- **File**: `src/extension/heuristics/ChangeClassifier.ts`

---

## Coding Conventions

### TypeScript
- **Strict Mode**: Always enabled (`"strict": true` in tsconfig.json)
- **Naming**:
  - Classes: PascalCase (`ChangeClassifier`, `EventCollector`)
  - Functions: camelCase (`recordChange()`, `classify()`)
  - Constants: UPPER_SNAKE_CASE (`PASTE_THRESHOLD_MS`)
  - Interfaces/Types: PascalCase with `I` prefix optional (`ClassificationResult`)
- **Comments**: Only for non-obvious logic; code should be self-documenting

### File Organization
```
src/
├── extension/          # All Node/VS Code API code
│   ├── extension.ts    # Entry point (activate/deactivate)
│   ├── heuristics/     # Classification logic
│   ├── collectors/     # Event aggregation
│   ├── storage/        # State/secret management
│   ├── api/            # Token polling (Phase 2+)
│   └── webview/        # Webview panel management
└── webview/            # All React/browser code
    ├── index.tsx       # React root
    ├── App.tsx         # Main component
    ├── components/     # Dumb components
    ├── hooks/          # Custom React hooks
    └── styles/         # CSS (minimize; prefer inline)
```

### React Components
- **Functional components** only (no class components)
- **Hooks**: Use React hooks (useState, useEffect, useRef) for state
- **Props**: Define interfaces for all props (`interface MyComponentProps { ... }`)
- **Example**:
  ```typescript
  interface MetricsSummaryProps {
    stats: SessionStats | null;
  }

  export function MetricsSummary({ stats }: MetricsSummaryProps) {
    if (!stats) return <div>Loading...</div>;
    return <div>{stats.aiGenerated} lines from AI</div>;
  }
  ```

### Error Handling
- **Extension code**: Use try-catch for async operations; log errors with masked secrets
- **Webview**: Gracefully handle missing VS Code API (in case of testing)
- **No silent failures**: Always log errors to VS Code output channel

---

## Build & Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Commands
```bash
# Install dependencies
npm install

# Development: Watch mode (rebuild on file change)
npm run watch

# Production: One-time build
npm run compile

# Package extension (creates .vsix file)
npm run package

# Run tests
npm run test

# Lint code
npm run lint
```

### Build Process
1. **esbuild.mjs** orchestrates two separate builds:
   - Extension bundle: `src/extension/extension.ts` → `dist/extension.js`
   - Webview bundle: `src/webview/index.tsx` → `media/dashboard.js`
2. **Source maps** generated for both (helpful for debugging)
3. **Minification** in production; disabled in development (faster builds)

### VS Code Testing
```bash
# Run extension in development environment
F5 (launches VS Code Extension Host with debugging)

# Test webview in isolation
- Edit src/webview/App.tsx
- Reload Extension Host (Ctrl+R)
- Open dashboard via Command Palette: "Wai: Open Dashboard"
```

---

## Data Model

### SessionStats (stored in globalState)
```typescript
interface SessionStats {
  startTime: number;           // Unix timestamp
  humanTyping: number;         // Character count
  aiGenerated: number;         // Character count
  pastes: number;              // Character count
  sessions: number;            // Cumulative count
  uniqueDaysActive: string[];  // ISO dates
  commandUsageCount: {
    [command: string]: number  // Copilot accepts, etc.
  };
  totalTokensUsed?: number;    // Phase 2: from API polling
  apiCostEstimate?: number;    // Phase 2: in cents or USD
}
```

### ChangeEvent (in-memory buffer)
```typescript
interface ChangeEvent {
  type: ChangeType;            // 'human' | 'ai' | 'paste' | 'unknown'
  confidence: number;           // 0.0 - 1.0
  characterCount: number;
  timestamp: number;
  languageId: string;
}

enum ChangeType {
  HUMAN_TYPING = 'human',
  AI_GENERATED = 'ai',
  PASTE = 'paste',
  UNKNOWN = 'unknown',
}
```

---

## Security Checklist

- [ ] **API Keys**: Always stored via `SecretStorage`, never in `settings.json`
- [ ] **Logging**: Mask secrets before logging (first 4 + last 4 chars)
- [ ] **CSP**: All webview scripts have `nonce` attribute; no `unsafe-eval`
- [ ] **Input Validation**: Validate API key format before storage
- [ ] **Command Injection**: Don't pass user input to shell commands
- [ ] **IPC Messages**: Validate message structure on extension side before processing
- [ ] **Clipboard**: Handle clipboard read failures gracefully (Linux may lack deps)

---

## Testing Strategy

### Unit Tests (Jest)
- **ChangeClassifier**: Decision tree logic with sample changes
- **PasteTracker**: State machine transitions (was replaced with heuristics, but pattern applies)
- **EventCollector**: Aggregation and stat calculation
- **SecretManager**: Encryption/decryption (mocked SecretStorage)

### Integration Tests
- Extension activation: Verify listeners registered
- State persistence: Write → reload extension → verify loaded
- Command execution: Dashboard open, API key input

### Manual Testing Checklist
- [ ] Single character typing → `HUMAN_TYPING` classification
- [ ] `function() { return 42; }` pasted → `PASTE` classification (>100 chars, <50ms)
- [ ] Copilot completion (multi-line) → `AI_GENERATED` classification
- [ ] Extension survives 1000+ rapid changes
- [ ] Stats persist across VS Code restart
- [ ] Dashboard loads and displays metrics
- [ ] API key securely stored (check OS keychain)
- [ ] Reset stats with confirmation works
- [ ] Undo doesn't re-classify

---

## Performance Guidelines

### Extension Performance
- **Target**: <5ms per change event (Classification + storage)
- **Memory**: <50MB resident set size
- **Polling**: API token checks every 5 minutes (Phase 2+), not per keystroke

### Webview Performance
- **Target**: <16ms per frame (60fps)
- **Chart Updates**: Throttle to 1x per second
- **No infinite loops**: Use `useEffect` dependencies carefully

### Common Pitfalls to Avoid
1. **Frequent disk writes**: Buffer in memory, sync every 30s
2. **Synchronous storage reads**: Use async/await with `await context.globalState.get()`
3. **Untracked subscriptions**: Always add to `context.subscriptions` for cleanup
4. **Memory leaks in webview**: Clean up event listeners in `useEffect` return
5. **Blocking operations in extension**: Use `setImmediate()` or `setTimeout()` for heavy work

---

## Debugging

### VS Code Extension
- **Debug mode**: F5 launches Extension Host with debugger attached
- **Breakpoints**: Set in `extension.ts` and hit during usage
- **Output Channel**: `vscode.window.createOutputChannel('Wai')` for logging
  ```typescript
  const outputChannel = vscode.window.createOutputChannel('Wai');
  outputChannel.appendLine(`Change: ${classification.type}, confidence: ${classification.confidence}`);
  ```

### Webview
- **DevTools**: Right-click webview → "Inspect Element" (requires `enableScripts: true`)
- **Console logs**: `console.log()` visible in webview DevTools
- **Network tab**: Disabled by CSP, but you'll see CSP violation errors

### Secrets (SecretStorage)
- **Windows**: Check Windows Credential Manager → `Credential Manager` app
- **macOS**: Check Keychain app → search for "wai" entries
- **Linux**: Check `secret-tool` output (if installed)

---

## Phase Roadmap

**Phase 1** (Current): Data Collector + Basic Dashboard
- Extension listens for text changes
- Heuristic classification
- State persistence
- Basic webview with metrics summary

**Phase 2**: API Integration & Rate Limit Tracking
- SecretStorage for API keys (OpenAI, Anthropic)
- Background token polling
- Rate limit warning in dashboard

**Phase 3**: Advanced Metrics & Insights
- Time-series charts (7-day view)
- Per-language statistics
- Team dashboard (optional: cloud sync)

**Phase 4**: Publishing & Distribution
- Package as VSIX
- Publish to VS Code Marketplace
- Community feedback loop

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/extension/extension.ts` | Entry point; registers all listeners and commands |
| `src/extension/heuristics/ChangeClassifier.ts` | Classification algorithm (AI vs human vs paste) |
| `src/extension/collectors/EventCollector.ts` | In-memory buffering and session aggregation |
| `src/extension/storage/StateManager.ts` | Wrapper around VS Code storage APIs |
| `src/extension/storage/SecretManager.ts` | Secure API key storage |
| `src/extension/webview/DashboardPanel.ts` | Webview lifecycle + CSP injection |
| `src/webview/App.tsx` | Root React component; message passing to extension |
| `package.json` | VS Code manifest; activation events, commands, dependencies |
| `esbuild.mjs` | Dual-bundle build orchestration |
| `CLAUDE.md` | This file; project guidelines |

---

## Resources & References

- **VS Code Extension API**: https://code.visualstudio.com/api
- **VS Code Webview Security**: https://code.visualstudio.com/api/extension-guides/webview#security
- **Content Security Policy (CSP)**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **React Hooks**: https://react.dev/reference/react
- **esbuild**: https://esbuild.github.io/

---

## Contributing & Maintenance

### Code Review Checklist
- [ ] TypeScript strict mode passes (no `any` unless justified)
- [ ] No secrets logged or hardcoded
- [ ] Performance targets met (<5ms per change event)
- [ ] Tests added/updated for new logic
- [ ] No breaking changes to data model
- [ ] CSP compliance verified (webview changes)

### Updating Dependencies
```bash
npm update              # Safe updates (patch + minor)
npm outdated           # Check for new versions
npm audit              # Check for security vulnerabilities
```

---

## Questions?

- **Architecture question?** → See sections above; check `src/extension/extension.ts` for flow
- **Build issue?** → Run `npm run watch` and check `dist/` output
- **Webview blank?** → Check browser console (F12) and VS Code output channel for CSP errors
- **Stats not saving?** → Verify `StateManager.setGlobalState()` is being called on deactivation

---

**Last Updated**: Phase 1 Planning
**Next Review**: Before Phase 2 (API Integration)
