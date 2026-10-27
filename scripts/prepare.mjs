// Prepares vscode/ for a Jesutobits build (VSCodium-style: this repository holds only the
// differences). Steps, all idempotent from a clean source tree:
//   1. Download the upstream source for upstream.json's tag (GitHub tarball) into vscode/.
//   2. Apply patches/*.patch in name order (each listed in PATCHES.md).
//   3. Merge product.overrides.json over vscode/product.json (null removes a key).
//   4. Optionally copy a built Jesutobits extension into vscode/extensions/jesutobits.
//
//   node scripts/prepare.mjs [--clean] [--extension <path to jesutobits/apps/vscode-extension>]
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values: args } = parseArgs({
  options: { clean: { type: "boolean" }, extension: { type: "string" } },
});
const upstream = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const source = join(root, "vscode");
const marker = join(source, ".jesutobits-prepared");

if (args.clean) rmSync(source, { recursive: true, force: true });

if (existsSync(marker)) {
  const prepared = readFileSync(marker, "utf8").trim();
  if (prepared !== upstream.tag) {
    throw new Error(`vscode/ was prepared for ${prepared}, not ${upstream.tag}; run with --clean`);
  }
  console.log(`vscode/ already prepared for ${upstream.tag}; re-merging product.json and the extension`);
} else {
  fetchSource();
  applyPatches();
}
mergeProduct();
if (args.extension) copyExtension(resolve(args.extension));
writeFileSync(marker, `${upstream.tag}\n`);
console.log(`vscode/ is ready (VS Code ${upstream.tag})`);

function fetchSource() {
  const cache = join(root, ".cache");
  const tarball = join(cache, `vscode-${upstream.tag}.tar.gz`);
  mkdirSync(cache, { recursive: true });
  if (!existsSync(tarball)) {
    const url = `https://codeload.github.com/${upstream.repository}/tar.gz/refs/tags/${upstream.tag}`;
    console.log(`downloading ${url}`);
    execFileSync("curl", ["-sSfL", "--retry", "3", "-o", tarball, url], { stdio: "inherit" });
  }
  rmSync(source, { recursive: true, force: true });
  mkdirSync(source, { recursive: true });
  // Relative paths: GNU tar (Git Bash) reads "C:" in an absolute path as a remote host.
  execFileSync(
    "tar",
    ["-xzf", `.cache/vscode-${upstream.tag}.tar.gz`, "-C", "vscode", "--strip-components=1"],
    { cwd: root, stdio: "inherit" },
  );
}

function applyPatches() {
  const dir = join(root, "patches");
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".patch")).sort()) {
    console.log(`applying ${name}`);
    execFileSync("git", ["apply", "--whitespace=nowarn", join(dir, name)], {
      cwd: source,
      stdio: "inherit",
    });
  }
}

function mergeProduct() {
  const file = join(source, "product.json");
  const product = JSON.parse(readFileSync(file, "utf8"));
  const overrides = JSON.parse(readFileSync(join(root, "product.overrides.json"), "utf8"));
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "$comment") continue;
    if (value === null) delete product[key];
    else product[key] = value;
  }
  writeFileSync(file, `${JSON.stringify(product, null, "\t")}\n`);
}

/**
 * The extension ships prebuilt (dist/ from `pnpm build:extension` in the jesutobits
 * repository). Its manifest loses the workspace dependencies and scripts, which mean nothing
 * here and would make the packager try to resolve them.
 */
function copyExtension(extensionDir) {
  if (!existsSync(join(extensionDir, "dist", "extension.js"))) {
    throw new Error(`${extensionDir} has no dist/extension.js; run pnpm build:extension there`);
  }
  const target = join(source, "extensions", "jesutobits");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const part of ["dist", "media"]) {
    cpSync(join(extensionDir, part), join(target, part), {
      recursive: true,
      filter: (path) => !path.endsWith(".map"),
    });
  }
  const manifest = JSON.parse(readFileSync(join(extensionDir, "package.json"), "utf8"));
  delete manifest.dependencies;
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest.private;
  writeFileSync(join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`copied the Jesutobits extension ${manifest.version} into extensions/jesutobits`);
}
