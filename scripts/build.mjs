// Builds Jesutobits for Windows x64 from a prepared vscode/ (scripts/prepare.mjs):
//   VSCode-win32-x64/                          the portable app
//   vscode/.build/win32-x64/user-setup/JesutobitsUserSetup-x64-<tag>.exe   the per-user installer
// Needs the Node version in vscode/.nvmrc, Python 3 and the MSVC build tools with the
// Spectre-mitigated libraries (README.md).
//
//   node scripts/build.mjs [--skip-install] [--no-installer]
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
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

const env = { ...process.env };
// The source is a tarball, not a Git checkout, so the build cannot ask Git for the commit.
// The installer, update paths and `product.json` use it.
env.BUILD_SOURCEVERSION = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8")).commit;
const signtool = findSigntool();
if (signtool) {
  // Packaging strips old signatures from bundled binaries with signtool (it signs nothing).
  // Windows spells the variable `Path`; update whichever name exists, never add a second.
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  env[pathKey] = `${dirname(signtool)};${env[pathKey] ?? ""}`;
  console.log(`using ${signtool}`);
}

const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: source, stdio: "inherit", env });
};

if (!args["skip-install"]) run("npm ci");
run("npm run gulp vscode-win32-x64-min");
if (!args["no-installer"]) {
  run("npm run gulp vscode-win32-x64-inno-updater");
  run("npm run gulp vscode-win32-x64-user-setup");
  // VS Code's Inno Setup script names its output VSCodeSetup.exe (build/win32/code.iss); the
  // installer does not depend on its file name, so it is renamed here rather than patched.
  const setupDir = join(source, ".build", "win32-x64", "user-setup");
  const { tag } = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
  const installer = join(setupDir, `JesutobitsUserSetup-x64-${tag}.exe`);
  renameSync(join(setupDir, "VSCodeSetup.exe"), installer);
  console.log(`Installer: ${installer}`);
}
console.log(`\nBuilt ${join(root, "VSCode-win32-x64")}`);

/** signtool.exe from PATH, or else from the newest Windows SDK (it is rarely on PATH). */
function findSigntool() {
  try {
    execSync("where signtool.exe", { stdio: "ignore" });
    return undefined;
  } catch {
    // Not on PATH: look in the Windows SDK.
  }
  const programFiles = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const kits = join(programFiles, "Windows Kits", "10", "bin");
  if (!existsSync(kits)) return undefined;
  const versions = readdirSync(kits)
    .filter((name) => /^\d+\.\d+\.\d+\.\d+$/.test(name))
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  for (const version of versions) {
    const candidate = join(kits, version, "x64", "signtool.exe");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
