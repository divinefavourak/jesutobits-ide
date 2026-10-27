# Patches

Every change to the VS Code source is a file in `patches/`, applied in name order by `scripts/prepare.mjs`, and listed here with its reason. Keep this list short: each patch is work at every upstream update (`UPSTREAM.md`), and ADR-0015 is revisited if it grows past about ten.

Branding and endpoints are not patches; they are data in `product.overrides.json`.

| Patch | What | Why |
|---|---|---|
| (none yet) | | |

Planned (ADR-0015, pivot step 16), each only if a contribution point or setting cannot do it:

- Jesutobits icons in `resources/win32`, `resources/linux` and `resources/darwin`, generated from `docs/assets/jesutobits-icon.svg`.
- The agent view in the secondary side bar on first run.
- A Jesutobits welcome page instead of VS Code's.
- Copilot and chat entry points hidden by default, since Jesutobits brings its own agent.

## Making a patch

1. `node scripts/prepare.mjs`, then edit files under `vscode/`.
2. `cd vscode && git init -q && git add -A && git commit -qm base` before editing is the easiest way to get a diff: `git diff > ../patches/NNN-short-name.patch`.
3. Add a row above. Check it applies from clean: `node scripts/prepare.mjs --clean`.
