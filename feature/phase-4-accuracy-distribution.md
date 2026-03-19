# Phase 4 Prompt — Accuracy & Distribution

You are continuing development of **Wai**, a VS Code extension that tracks AI coding usage. Phases 1, 2, and 3 are complete. Read `CLAUDE.md` first for full project context and coding conventions.

## Prerequisites — Verify Before Starting

Confirm the following exist:
- `src/extension/heuristics/ChangeClassifier.ts` — existing heuristic classifier
- `src/extension/extension.ts` — entry point with all commands registered
- `package.json` with existing commands and keybindings section
- `feature/phase-2-core-value.md` and `feature/phase-3-insights.md` implemented

---

## Your Task

Implement Phase 4: improve classification accuracy and distribute Wai to the Open VSX marketplace so Antigravity IDE users can install it with one click.

---

## Feature 1: Tab-Accept Heuristic (Improved Copilot Detection)

The current classifier is purely size-based (confidence 0.6-0.85). GitHub Copilot ghost text is accepted by pressing Tab. Detecting Tab → immediate large insertion gives ~0.95 confidence that the change is AI-generated.

**Create `src/extension/heuristics/TabAcceptTracker.ts`**:

```typescript
export class TabAcceptTracker {
  private recentTabAccept = false;
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call this when Tab is pressed in the editor. */
  recordTabPress(): void {
    this.recentTabAccept = true;
    if (this.clearTimer) clearTimeout(this.clearTimer);
    // Reset after 200ms — if no change event arrives, Tab was likely normal indentation
    this.clearTimer = setTimeout(() => {
      this.recentTabAccept = false;
    }, 200);
  }

  /** Returns true and resets the flag. */
  consumeTabAccept(): boolean {
    if (this.recentTabAccept) {
      this.recentTabAccept = false;
      if (this.clearTimer) clearTimeout(this.clearTimer);
      return true;
    }
    return false;
  }
}
```

**Update `src/extension/heuristics/ChangeClassifier.ts`**:
- Accept an optional `TabAcceptTracker` in the constructor
- At the start of `classify()`, call `this.tabTracker?.consumeTabAccept()`
- If it returns `true` AND `change.text.length > 3`: return `AI_GENERATED` with confidence `0.95` immediately, before running the size heuristics
- If Tab was consumed but insertion is ≤ 3 chars: fall through to normal classification (likely indentation)

**Register the Tab keybinding in `package.json`** under `contributes.keybindings`:
```json
{
  "command": "wai.recordTabAccept",
  "key": "tab",
  "when": "editorTextFocus && !editorReadonly && !suggestWidgetVisible && !inSnippetMode"
}
```

> **Important `when` clause**: Only intercept Tab when no suggestion widget is open and not in snippet mode. This prevents interfering with normal autocomplete selection and snippet navigation.

**Register the command in `src/extension/extension.ts`**:
```typescript
const tabTracker = new TabAcceptTracker();

context.subscriptions.push(
  vscode.commands.registerCommand('wai.recordTabAccept', async () => {
    tabTracker.recordTabPress();
    // Always execute the real Tab action after recording
    await vscode.commands.executeCommand('tab');
  })
);
```

Pass `tabTracker` to `ChangeClassifier` constructor.

> **Safety note**: The `when` clause + always delegating to `tab` command means normal Tab indentation is never broken. The only effect is setting a 200ms flag.

---

## Feature 2: Publish to Open VSX

Open VSX is the extension marketplace used by Antigravity IDE and other VS Code forks. Publishing here means any Antigravity user can find and install Wai with one click.

### Step 1: Update `package.json`

Add to `devDependencies`:
```json
"ovsx": "^0.9.0"
```

Add to `scripts`:
```json
"package": "vsce package --allow-missing-repository",
"publish:ovsx": "ovsx publish wai-*.vsix -p $OVSX_TOKEN",
"publish:all": "npm run package && npm run publish:ovsx"
```

Add a `repository` field (required for publishing):
```json
"repository": {
  "type": "git",
  "url": "https://github.com/gitgotgut/Wai.git"
},
"homepage": "https://github.com/gitgotgut/Wai",
"bugs": {
  "url": "https://github.com/gitgotgut/Wai/issues"
}
```

Add a `categories` update and `icon` reference for marketplace display:
```json
"categories": ["Other"],
"keywords": ["ai", "productivity", "analytics", "copilot", "tracking"]
```

### Step 2: Create GitHub Actions CI/CD Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to Open VSX

on:
  push:
    tags:
      - 'v*'   # Trigger on version tags: v0.1.0, v1.0.0, etc.

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build extension
        run: NODE_ENV=production npm run compile

      - name: Package VSIX
        run: npm run package

      - name: Publish to Open VSX
        env:
          OVSX_TOKEN: ${{ secrets.OVSX_TOKEN }}
        run: npm run publish:ovsx
```

### Step 3: Create a README.md

Create `README.md` (required for marketplace listing):

```markdown
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
```

### Step 4: Publishing Instructions (Manual, First Time)

Add these instructions as a comment block at the top of `.github/workflows/publish.yml` or in a `CONTRIBUTING.md`:

```
To publish manually:
1. Create an account at https://open-vsx.org
2. Generate a Personal Access Token at https://open-vsx.org/user-settings/tokens
3. Add the token as a GitHub repository secret named OVSX_TOKEN
4. Tag a release: git tag v0.1.0 && git push origin v0.1.0
5. The GitHub Action will build and publish automatically
```

---

## Acceptance Criteria

### Tab-Accept Heuristic
- [ ] Normal Tab indentation still works (no regression)
- [ ] Copilot completions accepted via Tab are classified as `AI_GENERATED` with confidence 0.95
- [ ] Tab in snippet mode does not trigger the tracker (verify `when` clause works)
- [ ] Tab with no following text change (empty line indent) does not affect stats

### Open VSX Publishing
- [ ] `npm run package` produces a `wai-X.Y.Z.vsix` file
- [ ] `.vsix` can be manually installed in Antigravity via "Extensions: Install from VSIX..."
- [ ] `README.md` exists and describes all features
- [ ] `repository`, `homepage`, and `bugs` fields are present in `package.json`
- [ ] `.github/workflows/publish.yml` exists with correct trigger (`tags: v*`)
- [ ] Build passes: `npm run compile`
- [ ] Commit and push to GitHub when complete

## Build & Release

```bash
npm install          # picks up ovsx
npm run compile      # build extension + webview
npm run package      # produce wai-X.Y.Z.vsix

# To publish (requires OVSX_TOKEN env var):
npm run publish:ovsx

# Or tag a release and let GitHub Actions handle it:
git tag v0.2.0
git push origin v0.2.0
```

## Important Notes

- Bump the `version` in `package.json` before each release (semver: `0.1.0`, `0.2.0`, etc.)
- The `.vsix` filename must match the pattern `wai-*.vsix` for the publish script to find it
- Test the `.vsix` in Antigravity before tagging a release
