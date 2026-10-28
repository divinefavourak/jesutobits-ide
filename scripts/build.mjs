// Builds Jesutobits from a prepared vscode/ (scripts/prepare.mjs), for one target:
//
//   win32-x64      VSCode-win32-x64/ and dist/JesutobitsSetup-<version>-windows-x64.exe (per-user installer)
//   linux-x64      VSCode-linux-x64/ and dist/jesutobits-<version>-linux-x64.{deb,rpm,tar.gz}
//   darwin-arm64   VSCode-darwin-arm64/Jesutobits.app and dist/Jesutobits-<version>-macos-arm64.{dmg,zip}
//   darwin-x64     the same for Intel Macs (macos-x64)
//
// <version> is the Jesutobits extension's version when it is built in, else VS Code's tag.
//
// Each follows the steps of VS Code's own release pipelines (vscode/build/azure-pipelines).
// Needs the Node version in vscode/.nvmrc and Python 3; on Windows the MSVC build tools with
// the Spectre-mitigated libraries, on Linux the packages the CI workflow installs, on macOS
// Xcode's command line tools (README.md).
//
// Mac apps are not signed with an Apple Developer ID (there is none yet): they are signed
// ad hoc, which Apple Silicon needs to run them at all, and macOS asks the user once to allow
// an app from an unidentified developer (System Settings > Privacy & Security > Open Anyway).
//
//   node scripts/build.mjs [--target <target>] [--skip-install] [--no-installer]
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const TARGETS = ["win32-x64", "linux-x64", "darwin-arm64", "darwin-x64"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "vscode");
const dist = join(root, "dist");
const { values: args } = parseArgs({
  options: {
    target: { type: "string", default: `${process.platform}-${process.arch === "arm64" ? "arm64" : "x64"}` },
    "skip-install": { type: "boolean" },
    "no-installer": { type: "boolean" },
  },
});
const target = args.target;
if (!TARGETS.includes(target)) {
  throw new Error(`Unknown target ${target}: use ${TARGETS.join(", ")}`);
}
const [os, arch] = target.split("-");

if (!existsSync(join(source, ".jesutobits-prepared"))) {
  throw new Error("vscode/ is not prepared; run node scripts/prepare.mjs first");
}
const wanted = readFileSync(join(source, ".nvmrc"), "utf8").trim();
if (process.versions.node !== wanted) {
  throw new Error(`VS Code ${readFileSync(join(source, ".jesutobits-prepared"), "utf8").trim()} builds with Node ${wanted}; this is ${process.versions.node}`);
}
const { tag, commit } = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const extensionManifest = join(source, "extensions", "jesutobits", "package.json");
const version = existsSync(extensionManifest)
  ? JSON.parse(readFileSync(extensionManifest, "utf8")).version
  : tag;

const env = { ...process.env, VSCODE_ARCH: arch, npm_config_arch: arch };
// The source is a tarball, not a Git checkout, so the build cannot ask Git for the commit.
// The installer, update paths and `product.json` use it.
env.BUILD_SOURCEVERSION = commit;

/** Runs a command in vscode/ (or `cwd`) with the build environment plus `extraEnv`. */
const run = (command, { cwd = source, extraEnv = {} } = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...env, ...extraEnv } });
};
mkdirSync(dist, { recursive: true });
/** Where gulp puts the app: next to vscode/. */
const app = join(root, `VSCode-${target}`);

if (os === "win32") buildWindows();
else if (os === "linux") buildLinux();
else buildMac();
console.log(`\nBuilt ${app}`);

function buildWindows() {
  const signtool = findSigntool();
  if (signtool) {
    // Packaging strips old signatures from bundled binaries with signtool (it signs nothing).
    // Windows spells the variable `Path`; update whichever name exists, never add a second.
    const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    env[pathKey] = `${dirname(signtool)};${env[pathKey] ?? ""}`;
    console.log(`using ${signtool}`);
  }
  if (!args["skip-install"]) run("npm ci");
  run("npm run gulp vscode-win32-x64-min");
  if (args["no-installer"]) return;
  run("npm run gulp vscode-win32-x64-inno-updater");
  run("npm run gulp vscode-win32-x64-user-setup");
  // VS Code's Inno Setup script names its output VSCodeSetup.exe (build/win32/code.iss); the
  // installer does not depend on its file name, so it is renamed here rather than patched.
  const installer = join(dist, `JesutobitsSetup-${version}-windows-x64.exe`);
  renameSync(join(source, ".build", "win32-x64", "user-setup", "VSCodeSetup.exe"), installer);
  console.log(`Installer: ${installer}`);
}

function buildLinux() {
  if (!args["skip-install"]) {
    // Native modules are built against VS Code's glibc 2.28 sysroot with Chromium's clang
    // (setup-env.sh), so the app runs on the same distributions as VS Code. setup-env.sh runs
    // build/ scripts, so build/'s own dependencies come first, as in VS Code's pipeline.
    run("npm ci", { cwd: join(source, "build") });
    run(
      "bash -c 'set -e; source ./build/azure-pipelines/linux/setup-env.sh; node build/npm/preinstall.ts; npm ci'",
    );
  }
  run(`npm run gulp vscode-linux-${arch}-min`);
  if (args["no-installer"]) return;
  const name = `jesutobits-${version}-linux-${arch}`;
  run(`npm run gulp vscode-linux-${arch}-prepare-deb`);
  run(`npm run gulp vscode-linux-${arch}-build-deb`);
  moveOnly(join(source, ".build", "linux", "deb", "amd64", "deb"), ".deb", join(dist, `${name}.deb`));
  run(`npm run gulp vscode-linux-${arch}-prepare-rpm`);
  run(`npm run gulp vscode-linux-${arch}-build-rpm`);
  moveOnly(join(source, ".build", "linux", "rpm", "x86_64"), ".rpm", join(dist, `${name}.rpm`));
  const tarball = join(dist, `${name}.tar.gz`);
  run(
    `tar -czf '${tarball}' --transform 's,^VSCode-linux-${arch},Jesutobits-linux-${arch},' -C .. VSCode-linux-${arch}`,
  );
  console.log(`Package: ${tarball}`);
}

function buildMac() {
  if (!args["skip-install"]) {
    // node-gyp needs setuptools on Python 3.12; Kerberos must link normally on macOS (VS
    // Code's darwin pipeline does both).
    run("python3 -m pip install --quiet setuptools");
    run("npm ci", { extraEnv: { GYP_DEFINES: "kerberos_use_rtld=false" } });
  }
  run(`npm run gulp vscode-darwin-${arch}-min`);
  const bundle = join(app, "Jesutobits.app");
  // Packaging changed Electron's bundle, so its signature no longer holds; an ad hoc one lets
  // macOS run it (Apple Silicon refuses unsigned code). There is no Developer ID to notarise.
  run(`codesign --force --deep --sign - '${bundle}'`);
  run(`codesign --verify --deep --strict '${bundle}'`);
  if (args["no-installer"]) return;
  const name = `Jesutobits-${version}-macos-${arch}`;
  const zip = join(dist, `${name}.zip`);
  run(`ditto -c -k --sequesterRsrc --keepParent '${bundle}' '${zip}'`);
  console.log(`Package: ${zip}`);
  // A plain disk image: the app and a shortcut to Applications to drag it onto. VS Code's
  // create-dmg.ts names the volume after its own release quality ("VS Code", "Code OSS").
  const staging = join(source, ".build", "darwin", "dmg");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  run(`ditto '${bundle}' '${join(staging, "Jesutobits.app")}'`);
  run(`ln -s /Applications '${join(staging, "Applications")}'`);
  const dmg = join(dist, `${name}.dmg`);
  run(`hdiutil create -volname Jesutobits -srcfolder '${staging}' -ov -format UDZO '${dmg}'`);
  console.log(`Package: ${dmg}`);
}

/** Moves the one file with `extension` in `folder` to `destination`. */
function moveOnly(folder, extension, destination) {
  const files = readdirSync(folder).filter((file) => file.endsWith(extension));
  if (files.length !== 1) {
    throw new Error(`Expected one ${extension} in ${folder}, found ${files.length}`);
  }
  renameSync(join(folder, files[0]), destination);
  console.log(`Package: ${destination}`);
}

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
