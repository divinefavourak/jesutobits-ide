# Patches

Every change to the VS Code source is a file in `patches/`, applied in name order by `scripts/prepare.mjs`, and listed here with its reason. Keep this list short: each patch is work at every upstream update (`UPSTREAM.md`), and ADR-0015 is revisited if it grows past about ten.

Branding and endpoints are not patches; they are data in `product.overrides.json`.

| Patch | What | Why |
|---|---|---|
| `001-build-without-copilot.patch` | Drops `extensions/copilot` from the postinstall folders (`build/npm/dirs.ts`) and skips the Copilot ripgrep shim step when no Copilot extension was packaged (`build/gulpfile.vscode.ts`). `prepare.mjs` deletes `extensions/copilot`. | Copilot's build mixes in Microsoft's internal `vscode-capi` repository, so forks cannot build it, and without it packaging failed in `prepareBuiltInCopilotRipgrepShim`. Jesutobits brings its own agent |
| `002-copilot-off-and-welcome-text.patch` | `chat.disableAIFeatures` defaults to `true`; the welcome page's subtitle reads "An AI agent that builds in front of you" and its walkthrough "Get started with Jesutobits". | The setting hides Copilot's chat, "Sign in to GitHub" and "Sign In" prompts and status items, none of which work without Copilot. Users can turn it back on. The texts named VS Code |
| `003-jesutobits-welcome-popup.patch` | Adds `welcomeOnboarding/browser/jesutobitsOnboarding.ts` (with `media/jesutobits.css`), registered as the onboarding service in place of `OnboardingVariationA`, and the `workbench.action.jesutobitsWelcome` command. `startupPage.ts` no longer skips the onboarding when Copilot's AI features are hidden. | The first-run popup is VS Code's own modal with Jesutobits' four steps (a little hello, theme, OpenRouter key/model/permission, first idea) instead of GitHub sign-in. Its choices are settings or calls to the Jesutobits extension's commands (`jesutobits.setApiKey`, `hasApiKey`, `chooseModel`, `compose`), so the key never leaves VS Code's password box. Upstream's check hid the popup because patch 002 hides Copilot |
| `004-jesutobits-studio-layout.patch` | Adds `browser/parts/editor/jesutobitsGreeting.ts` (with `media/jesutobitsGreeting.css`): "A little idea, coming to life / See what you're building." and the open folder's name in a fixed 64 px strip above the main editor area; `editorPart.ts` reserves that strip in `layout()` (main window only) and the `workbench.jesutobits.greeting` setting turns it off. Adds `welcomeOnboarding/browser/jesutobitsStudio.ts`: Get Started, New Project and Themes buttons in the title bar (`MenuId.TitleBar`, leading group). The welcome popup opens the Studio side bar section and the agent as it closes. | The Studio design's middle column greeting and top bar. Extensions cannot add title-bar buttons or anything above the editor groups. The popup opens the Studio section because VS Code collapses a newly added Explorer view, and doing it while the popup is open would take focus out of it |

Icons and logo files are not patches either: they live in `branding/` at the paths they replace and are copied over the source. Regenerate them from the "J" tile with `node scripts/gen-app-icons.mjs --out ../jesutobits-ide/branding` in the `jesutobits` repository.

Planned (ADR-0015, pivot step 16), each only if a contribution point or setting cannot do it:

- The agent view in the secondary side bar on first run.
- macOS icons (`resources/darwin/code.icns`) when macOS builds are scheduled.

## Making a patch

1. `node scripts/prepare.mjs`, then edit files under `vscode/`.
2. `cd vscode && git init -q && git add -A && git commit -qm base` before editing is the easiest way to get a diff: `git diff > ../patches/NNN-short-name.patch`.
3. Add a row above. Check it applies from clean: `node scripts/prepare.mjs --clean`.
