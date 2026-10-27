# jesutobits-ide

The Jesutobits app: [Code-OSS](https://github.com/microsoft/vscode) rebranded, with Jesutobits' agent built in (ADR-0015 in the Jesutobits repository).

This repository holds only the differences from upstream, in the style of VSCodium:

| File | What it is |
|---|---|
| `upstream.json` | The VS Code release this build follows |
| `product.overrides.json` | Jesutobits' identity, Open VSX as the extension gallery, Microsoft-only keys removed |
| `patches/*.patch` | Changes to the VS Code source, each explained in `PATCHES.md` |
| `scripts/prepare.mjs` | Downloads the upstream source, applies the patches, merges `product.json`, optionally adds the Jesutobits extension |
| `scripts/build.mjs` | `npm ci` and the gulp tasks for the Windows app and its installer |

The Jesutobits logic (agent runtime, extension, agent panel) lives in the `jesutobits` repository; this one never contains it. Updating to a new VS Code release is described in `UPSTREAM.md`.

## Build

Prerequisites (Windows x64): the Node version in VS Code's `.nvmrc` (24.18.0 for 1.143.1), Python 3, Visual Studio Build Tools with "Desktop development with C++" and the **MSVC Spectre-mitigated libraries**, Git, and about 16 GB of RAM and 15 GB of free disk. The npm registry and GitHub must be reachable.

```powershell
node scripts/prepare.mjs                                          # Code-OSS rebranded as Jesutobits
node scripts/prepare.mjs --extension ..\jesutobits\apps\vscode-extension   # ... with the agent built in
node scripts/build.mjs                                            # VSCode-win32-x64\ and the user installer
```

For the extension, run `pnpm build:packages && pnpm build:extension` in the `jesutobits` repository first. `prepare.mjs --clean` starts again from a fresh download.

CI (`.github/workflows/build.yml`) builds the rebranded app without the extension and uploads the installer as an artifact.

## What is different from Code-OSS

- Name, data folders (`.jesutobits`), Windows app IDs and URL protocol (`jesutobits://`) are Jesutobits' own, so it installs next to VS Code without sharing anything.
- Extensions come from [Open VSX](https://open-vsx.org). The Visual Studio Marketplace and Microsoft's proprietary extensions are not available to forks.
- No telemetry endpoint, no update service, no Microsoft voice service, no Copilot defaults.
- The Jesutobits extension is built in (when prepared with `--extension`).

Code-OSS is MIT-licensed by Microsoft (`vscode/LICENSE.txt` in every build). "Visual Studio Code" and its logo are Microsoft trademarks and are not used here.
