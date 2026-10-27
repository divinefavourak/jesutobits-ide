// Builds Jesutobits for Windows x64 from a prepared vscode/ (scripts/prepare.mjs):
//   VSCode-win32-x64/                          the portable app
//   vscode/.build/win32-x64/user-setup/*.exe   the per-user installer (Inno Setup)
// Needs the Node version in vscode/.nvmrc, Python 3 and the MSVC build tools with the
// Spectre-mitigated libraries (README.md).
//
//   node scripts/build.mjs [--skip-install] [--no-installer]
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "vscode");
const { values: args } = parseArgs({
  options: { "skip-install": { type: "boolean" }, "no-installer": { type: "boolean" } },
});

if (!existsSync(join(source, ".jesutobits-prepared"))) {
  throw new Error("vscode/ is not prepared; run node scripts/prepare.mjs first");
}
const wanted = readFileSync(join(source, ".nvmrc"), "utf8").trim();
if (process.versions.node !== wanted) {
  throw new Error(`VS Code ${readFileSync(join(source, ".jesutobits-prepared"), "utf8").trim()} builds with Node ${wanted}; this is ${process.versions.node}`);
}

const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: source, stdio: "inherit" });
};

if (!args["skip-install"]) run("npm ci");
run("npm run gulp vscode-win32-x64-min");
if (!args["no-installer"]) {
  run("npm run gulp vscode-win32-x64-inno-updater");
  run("npm run gulp vscode-win32-x64-user-setup");
}
console.log(`\nBuilt ${join(root, "VSCode-win32-x64")}`);
