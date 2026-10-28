# jesutobits-ide

The Jesutobits app: [Code-OSS](https://github.com/microsoft/vscode) rebranded, with Jesutobits' agent built in (ADR-0015 in the Jesutobits repository).

This repository holds only the differences from upstream, in the style of VSCodium:

| File | What it is |
|---|---|
| `upstream.json` | The VS Code release this build follows |
| `product.overrides.json` | Jesutobits' identity, Open VSX as the extension gallery, Microsoft-only keys removed |
| `patches/*.patch` | Changes to the VS Code source, each explained in `PATCHES.md` |
| `branding/` | The "J" icons and logo files, at the paths they replace in the source |
| `scripts/prepare.mjs` | Downloads the upstream source, applies the patches, merges `product.json`, optionally adds the Jesutobits extension |
| `scripts/build.mjs` | `npm ci` and the gulp tasks for one platform's app and its packages (`--target win32-x64`, `linux-x64`, `darwin-arm64`, `darwin-x64`) |

The Jesutobits logic (agent runtime, extension, agent panel) lives in the `jesutobits` repository; this one never contains it. Updating to a new VS Code release is described in `UPSTREAM.md`.

## Build

Prerequisites on every platform: the Node version in VS Code's `.nvmrc` (24.18.0 for 1.143.1), Python 3, Git, and about 16 GB of RAM and 15 GB of free disk. The npm registry and GitHub must be reachable. Then:

- **Windows x64:** Visual Studio Build Tools with "Desktop development with C++" and the **MSVC Spectre-mitigated libraries**.
- **Linux x64:** `pkg-config libgtk-3-0 libxkbfile-dev libkrb5-dev libgbm1 rpm fakeroot dpkg` (Debian/Ubuntu names). Native modules are built against VS Code's glibc 2.28 sysroot, downloaded by the build.
- **macOS (Apple Silicon or Intel):** Xcode's command line tools. Build each architecture on a Mac of that architecture.

```powershell
node scripts/prepare.mjs                                          # Code-OSS rebranded as Jesutobits
node scripts/prepare.mjs --extension ..\jesutobits\apps\vscode-extension   # ... with the agent built in
node scripts/build.mjs                                            # this machine's platform, into dist/
node scripts/build.mjs --target linux-x64                         # or name the target
```

| Target | `dist/` |
|---|---|
| `win32-x64` | `JesutobitsUserSetup-x64-<tag>.exe` (per-user installer) |
| `linux-x64` | `jesutobits-linux-x64-<tag>.deb`, `.rpm` and `.tar.gz` |
| `darwin-arm64`, `darwin-x64` | `Jesutobits-darwin-<arch>-<tag>.dmg` and `.zip` |

**Mac apps are signed ad hoc, not with an Apple Developer ID** (there is none yet), so they are not notarised. macOS blocks the first open: open System Settings > Privacy & Security and choose **Open Anyway** for Jesutobits (or run `xattr -dr com.apple.quarantine /Applications/Jesutobits.app`). With a Developer ID, signing and notarising would follow VS Code's `build/azure-pipelines/darwin/codesign.ts`.

For the extension, run `pnpm build:packages && pnpm build:extension` in the `jesutobits` repository first. `prepare.mjs --clean` starts again from a fresh download.

CI (`.github/workflows/build.yml`) builds the Jesutobits extension from the `jesutobits` repository (the `pivot/code-oss` branch until it is merged; choose another ref when running it by hand), builds the app with it built in, and uploads each platform's packages as an artifact (`jesutobits-<target>`). The four platforms build in parallel and one failing does not stop the others.

## What is different from Code-OSS

- Name, data folders (`.jesutobits`), Windows app IDs and URL protocol (`jesutobits://`) are Jesutobits' own, so it installs next to VS Code without sharing anything.
- Extensions come from [Open VSX](https://open-vsx.org). The Visual Studio Marketplace and Microsoft's proprietary extensions are not available to forks.
- The "J" icon everywhere: the app, the installer, the title bar and the empty-editor watermark.
- No telemetry endpoint, no update service, no Microsoft voice service, and no Copilot extension (it cannot be built outside Microsoft). Copilot's chat and GitHub sign-in prompts are hidden by default (`chat.disableAIFeatures`).
- The Jesutobits extension is built in (when prepared with `--extension`).

Code-OSS is MIT-licensed by Microsoft (`vscode/LICENSE.txt` in every build). "Visual Studio Code" and its logo are Microsoft trademarks and are not used here.
