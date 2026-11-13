// Packs the Vault's 5e rules into one JavaScript file the desktop app embeds.
//
//   node scripts/build-rules.mjs <path to the bertinis-vault checkout>
//
// The output has no imports and touches no browser or Node API: it has to run
// in an embedded interpreter with nothing but the language. `check-rules.mjs`
// holds it to that.
//
// The bundle is committed, with the Vault commit it was built from beside it.
// Building it in CI would need a token that can read the other private
// repository; a file with a recorded origin needs nothing.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vault = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node scripts/build-rules.mjs <path to bertinis-vault>");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../apps/forja/rules");

// esbuild comes with the Vault's own Vite, so the bundle is built by the same
// tool, at the same version, that builds the web.
const fromWeb = createRequire(join(vault, "apps/web/package.json"));
const fromVite = createRequire(fromWeb.resolve("vite"));
const esbuild = fromVite("esbuild");

const pkg = (name) => join(vault, "packages", name, "src/index.ts");

// The whole surface the desktop calls. Everything crosses as JSON text, so the
// interpreter boundary carries strings and nothing else.
const entry = `
import { applyAction } from "./actions";
import { coerceBuilderState, freshDraft, initialState } from "./builder-state";
import { allOptions, coreOptions, entryById, subclassesFor, subracesFor } from "./catalog";
import { chamberOrder } from "./chambers";
import { missingPieces } from "./derive";
import { settleDraft } from "./settle";
import { optionsFor } from "./index-options";
import { exportCodex, mergeCodex, readCodexFile } from "./codex-file";
import { readFoundryActor } from "./foundry-import";
import { sigilFor } from "./role-sigil";
import { suggestAppearance } from "./appearance";
import { sizeFor } from "./table-numbers";
import { rulesVersionOf } from "./builder-state";
import { setBookLibrary } from "@bertinis-vault/vetools-ref";
import {
  callingView,
  coverView,
  derivedOf,
  foundryPayloadOf,
  gearView,
  giftsView,
  growthView,
  pointBuyView,
  recordView,
  sheetView,
  spellsView,
  tomeView,
} from "./screens";

// "Sugerir por especie" of the web's identity chamber (Forge.tsx suggestLooks):
// the same call with the same arguments; the patch only fills empty boxes.
const suggestLooks = (draft) => {
  const rulesVersion = rulesVersionOf(draft);
  const suggestion = suggestAppearance(draft.raceId, draft.subraceId, rulesVersion, sizeFor(draft, rulesVersion));
  if (!suggestion) return {};
  const patch = {};
  for (const [field, value] of Object.entries(suggestion)) {
    if (value && !String(draft[field] ?? "").trim()) patch[field] = value;
  }
  return patch;
};

// What each screen shows lives in the package (forge/screens), shared with the
// web. This is only the door: names, and the JSON that crosses it.
const featOptions = (rulesVersion, search) => optionsFor({ prop: "feat", rulesVersion, search, limit: 60 });
const itemOptions = (rulesVersion, search, kind) =>
  optionsFor({
    prop: "item",
    rulesVersion,
    search,
    limit: 40,
    weaponsOnly: kind === "weapon",
    armorOnly: kind === "armor",
  });

const api = {
  applyAction,
  settleDraft,
  coerceBuilderState,
  resolveDraft: derivedOf,
  freshDraft,
  initialState: () => initialState,
  allOptions,
  coreOptions,
  entryById,
  subracesFor,
  subclassesFor,
  chamberOrder,
  missingPieces,
  setBookLibrary: (library) => (setBookLibrary(library), null),
  view: sheetView,
  recordView,
  coverView,
  tomeView,
  growthView,
  featOptions,
  giftsView,
  gearView,
  itemOptions,
  spellsView,
  pointBuyView,
  callingView,
  foundryPayload: foundryPayloadOf,
  exportCodex,
  readCodexFile,
  readFoundryActor,
  sigilFor,
  suggestLooks,
  mergeCodex,
};

globalThis.forge = {
  names: Object.keys(api),
  invoke(name, argsJson) {
    const fn = api[name];
    if (!fn) throw new Error("forge: no function named " + name);
    const result = fn(...JSON.parse(argsJson));
    return JSON.stringify(result === undefined ? null : result);
  },
};
`;

const result = await esbuild.build({
  stdin: { contents: entry, resolveDir: join(vault, "packages/forge/src"), loader: "ts" },
  bundle: true,
  format: "iife",
  platform: "neutral",
  mainFields: ["module", "main"],
  target: "es2020",
  minify: true,
  legalComments: "none",
  write: false,
  alias: {
    "@bertinis-vault/contracts": pkg("contracts"),
    "@bertinis-vault/data-engine": pkg("data-engine"),
    "@bertinis-vault/domain": pkg("domain"),
    "@bertinis-vault/vetools-index": pkg("vetools-index"),
    "@bertinis-vault/vetools-ref": pkg("vetools-ref"),
  },
});

const git = (...args) => execFileSync("git", args, { cwd: vault, encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", "packages") !== "";

mkdirSync(out, { recursive: true });
const code = result.outputFiles[0].text;
writeFileSync(join(out, "forge.js"), code);
writeFileSync(
  join(out, "forge.origin.json"),
  JSON.stringify({ repository: "Joabertini/bertinis-vault", commit: git("rev-parse", "HEAD"), dirty }, null, 2) + "\n",
);

console.log(`forge.js: ${(code.length / 1024).toFixed(0)} KB, from ${git("rev-parse", "--short", "HEAD")}${dirty ? " (dirty)" : ""}`);
