# Following VS Code releases

Jesutobits follows VS Code's stable releases, within a month of each one (ROADMAP Q14).

1. Set the new tag in `upstream.json` (stable tags look like `1.144.0`; list them with `git ls-remote --tags https://github.com/microsoft/vscode 'refs/tags/1.*'`).
2. `node scripts/prepare.mjs --clean`. If a patch no longer applies, redo it against the new source (`PATCHES.md`, "Making a patch") and replace the file.
3. Compare the new upstream `product.json` with the last one: any new key that names a Microsoft service, telemetry, update or AI endpoint gets an entry in `product.overrides.json` (set to `null` or to Jesutobits' value).
4. Check the new `.nvmrc` and build prerequisites (README.md), and the extension's `engines.vscode` in the `jesutobits` repository.
5. Build, install, and smoke-test: the app starts as Jesutobits with its own data folder, Open VSX search works, and with the extension built in the agent panel completes a scripted turn.
6. Commit as "VS Code <tag>".

ADR-0015's revisit trigger: if this takes more than two days a month for three months in a row.
