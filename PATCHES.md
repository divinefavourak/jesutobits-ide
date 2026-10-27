# Patches

Every change to the VS Code source is a file in `patches/`, applied in name order by `scripts/prepare.mjs`, and listed here with its reason. Keep this list short: each patch is work at every upstream update (`UPSTREAM.md`), and ADR-0015 is revisited if it grows past about ten.

Branding and endpoints are not patches; they are data in `product.overrides.json`.

| Patch | What | Why |
|---|---|---|
| `001-build-without-copilot.patch` | Drops `extensions/copilot` from the postinstall folders (`build/npm/dirs.ts`) and skips the Copilot ripgrep shim step when no Copilot extension was packaged (`build/gulpfile.vscode.ts`). `prepare.mjs` deletes `extensions/copilot`. | Copilot's build mixes in Microsoft's internal `vscode-capi` repository, so forks cannot build it, and without it packaging failed in `prepareBuiltInCopilotRipgrepShim`. Jesutobits brings its own agent |
| `002-copilot-off-and-welcome-text.patch` | `chat.disableAIFeatures` defaults to `true`; the welcome page's subtitle reads "An AI agent that builds in front of you" and its walkthrough "Get started with Jesutobits". | The setting hides Copilot's chat, "Sign in to GitHub" and "Sign In" prompts and status items, none of which work without Copilot. Users can turn it back on. The texts named VS Code |

Icons and logo files are not patches either: they live in `branding/` at the paths they replace and are copied over the source. Regenerate them from the "J" tile with `node scripts/gen-app-icons.mjs --out ../jesutobits-ide/branding` in the `jesutobits` repository.

Planned (ADR-0015, pivot step 16), each only if a contribution point or setting cannot do it:

- The agent view in the secondary side bar on first run.
- A Jesutobits welcome page instead of VS Code's.
- macOS icons (`resources/darwin/code.icns`) when macOS builds are scheduled.

## Making a patch

1. `node scripts/prepare.mjs`, then edit files under `vscode/`.
2. `cd vscode && git init -q && git add -A && git commit -qm base` before editing is the easiest way to get a diff: `git diff > ../patches/NNN-short-name.patch`.
3. Add a row above. Check it applies from clean: `node scripts/prepare.mjs --clean`.
