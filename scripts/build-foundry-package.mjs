import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const moduleDir = path.join(repoRoot, "apps", "foundry-module");
const outDir = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repoRoot, "apps", "web", "dist", "foundry");

const site = "https://alba.bertinilabs.xyz";
const zipName = "bertinis-vault.zip";

// What a Foundry install needs and nothing else: the manifest at the root of
// the archive, plus the three directories it names. Tests, README and
// package.json stay out — the module is loaded, not built, on the other side.
const packaged = ["module.json", "src", "lang", "styles"];

async function collect(relative) {
  const absolute = path.join(moduleDir, relative);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    return [[relative, await readFile(absolute)]];
  }
  const nested = await Promise.all(
    entries.map((entry) => collect(path.posix.join(relative, entry.name))),
  );
  return nested.flat();
}

const manifestSource = await readFile(path.join(moduleDir, "module.json"), "utf8");
const manifest = JSON.parse(manifestSource);

// The repo is private, so `raw.githubusercontent.com` and the release assets
// both answer 404 to Foundry. Both URLs have to be served by the site, and the
// copy inside the zip is the one an installed module polls for updates — if it
// pointed back at GitHub, the module would install once and never update again.
const required = {
  manifest: `${site}/foundry/module.json`,
  download: `${site}/foundry/${zipName}`,
};
const wrong = Object.entries(required).filter(([field, url]) => manifest[field] !== url);
if (wrong.length) {
  console.error("apps/foundry-module/module.json does not point at the deployed site:");
  for (const [field, url] of wrong) {
    console.error(`- "${field}" is ${JSON.stringify(manifest[field])}, expected ${JSON.stringify(url)}`);
  }
  process.exit(1);
}

const files = (await Promise.all(packaged.map((entry) => collect(entry)))).flat();
const zip = zipSync(Object.fromEntries(files), { level: 9 });

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "module.json"), manifestSource);
await writeFile(path.join(outDir, zipName), zip);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;
console.log(`Foundry module v${manifest.version} packaged into ${path.relative(repoRoot, outDir)}`);
console.log(`  module.json  ${kb(Buffer.byteLength(manifestSource))}`);
console.log(`  ${zipName}   ${kb(zip.length)} (${files.length} files)`);
