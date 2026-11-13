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
import { parseMarkup } from "./rules-markup";
import { metaLinesFor, PROPERTIES } from "./rules-meta";
import { factsFor, KIND_LABEL as ITEM_KIND_LABEL, RARITY_LABEL, RARITY_TINT } from "./item-facts";
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

// The InfoPanel of the web (components/info), as data: what RulesBody draws,
// flattened into blocks the desktop paints. Every string goes through
// parseMarkup, so links, rolls and bold read as in the web.
const spansOf = (text, style = "") => {
  const out = [];
  const walk = (nodes, style) => {
    for (const node of nodes) {
      if (node.t === "text") out.push({ s: node.s, style });
      else if (node.t === "roll") out.push({ s: node.s, style: "roll" });
      else if (node.t === "link") out.push({ s: node.label, style: "link", ref: node.ref });
      else if (node.t === "fmt") walk(node.children, node.style === "b" || node.style === "i" ? node.style : style || "i");
    }
  };
  walk(parseMarkup(String(text)), style);
  return out;
};
const asList = (value) => (Array.isArray(value) ? value : []);
const ABILITY = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
function blocksOf(entry, depth, out) {
  if (typeof entry === "string") {
    out.push({ k: "p", depth, spans: spansOf(entry) });
    return;
  }
  if (!entry || typeof entry !== "object") return;
  const children = asList(entry.entries ?? (entry.entry !== undefined ? [entry.entry] : []));
  const name = typeof entry.name === "string" ? entry.name : "";
  switch (entry.type) {
    case "list":
      for (const item of asList(entry.items)) {
        if (typeof item === "string") out.push({ k: "li", depth, spans: spansOf(item) });
        else {
          const body = asList(item.entries ?? (item.entry !== undefined ? [item.entry] : []));
          const spans = typeof item.name === "string" ? [...spansOf(item.name, "b"), { s: " ", style: "" }] : [];
          for (const child of body) if (typeof child === "string") spans.push(...spansOf(child), { s: " ", style: "" });
          out.push({ k: "li", depth, spans });
          for (const child of body) if (typeof child !== "string") blocksOf(child, depth + 1, out);
        }
      }
      return;
    case "table": {
      const cell = (c) => {
        if (typeof c === "string" || typeof c === "number") return spansOf(String(c));
        if (c && typeof c === "object" && c.roll) return [{ s: c.roll.exact !== undefined ? String(c.roll.exact) : \`\${c.roll.min}–\${c.roll.max}\`, style: "" }];
        if (c && typeof c === "object" && typeof c.entry === "string") return spansOf(c.entry);
        return [];
      };
      out.push({
        k: "table",
        depth,
        caption: typeof entry.caption === "string" ? entry.caption : "",
        head: asList(entry.colLabels).map((l) => spansOf(String(l))),
        rows: asList(entry.rows).map((row) => asList(row).map(cell)),
      });
      return;
    }
    case "item": {
      const spans = typeof entry.name === "string" ? [...spansOf(entry.name, "b"), { s: " ", style: "" }] : [];
      for (const child of children) if (typeof child === "string") spans.push(...spansOf(child), { s: " ", style: "" });
      out.push({ k: "p", depth, spans });
      return;
    }
    case "quote":
      for (const child of children) if (typeof child === "string") out.push({ k: "quote", depth, spans: spansOf(child, "i") });
      if (typeof entry.by === "string") out.push({ k: "quote", depth, spans: [{ s: \`— \${entry.by}\`, style: "" }] });
      return;
    case "hr":
      out.push({ k: "hr", depth });
      return;
    case "abilityDc":
    case "abilityAttackMod": {
      const attributes = asList(entry.attributes).map((key) => ABILITY[key] ?? key);
      const label = entry.type === "abilityDc" ? "save DC" : "attack modifier";
      const base = entry.type === "abilityDc" ? "8 + " : "";
      out.push({ k: "p", depth, center: true, spans: [{ s: name || \`Spell \${label}\`, style: "b" }, { s: \` = \${base}your proficiency bonus + your \${attributes.join(" or ")} modifier\`, style: "i" }] });
      return;
    }
    case "inset":
    case "insetReadaloud":
      if (name) out.push({ k: "h", depth: 1, inset: true, spans: spansOf(name) });
      for (const child of children) blocksOf(child, depth + 1, out);
      return;
    default:
      if (name) out.push({ k: "h", depth, spans: spansOf(name) });
      for (const child of children) blocksOf(child, depth + 1, out);
  }
}
// "Rage|Barbarian||1" and "Path Feature|Barbarian||Berserker||3" (InfoPanel featureRef).
function featureRef(text, kind, owner) {
  const parts = text.split("|");
  const classSource = parts[2] || (kind === "class" ? owner.source : String(owner.classSource ?? "PHB"));
  if (kind === "class") {
    return { kind: "classFeature", name: parts[0] ?? "", className: parts[1] ?? owner.name, classSource, level: Number(parts[3]), source: parts[4] || classSource };
  }
  return {
    kind: "subclassFeature",
    name: parts[0] ?? "",
    className: parts[1] ?? String(owner.className ?? ""),
    classSource,
    subclass: parts[3] ?? String(owner.shortName ?? ""),
    level: Number(parts[5]),
    source: parts[6] || parts[4] || owner.source,
  };
}
const rulesDoc = (kind, record) => {
  const meta = metaLinesFor(kind, record).map((line) => ({ label: line.label, spans: spansOf(line.text) }));
  const blocks = [];
  for (const entry of asList(record.entries)) blocksOf(entry, 0, blocks);
  for (const entry of asList(record.entriesHigherLevel)) blocksOf(entry, 0, blocks);
  let features = [];
  if (kind === "class" || kind === "subclass") {
    features = asList(record.classFeatures ?? record.subclassFeatures)
      .map((e) => (typeof e === "string" ? e : e && typeof e === "object" && "classFeature" in e ? String(e.classFeature) : ""))
      .filter(Boolean)
      .map((text) => featureRef(text, kind, record));
  }
  const empty = asList(record.entries).length === 0 && meta.length === 0 && kind !== "class" && kind !== "subclass";
  return { name: record.name, source: record.source, meta, blocks, features, empty };
};

// ItemFacts of the web's Equipo chamber: what the picked weapon or armour
// does, read off the index through factsFor, with the names the info panel
// opens (the item, each property, each mastery).
const itemFactsView = (draft, which) => {
  const id = which === "armor" ? draft.armorId : draft.weaponId;
  if (!id) return null;
  const facts = factsFor(id, rulesVersionOf(draft), draft.sourceBooks?.[\`item:\${id}\`]);
  if (!facts) return null;
  const { row, weapon, armor } = facts;
  return {
    name: row.name,
    source: row.source,
    kind: ITEM_KIND_LABEL[facts.kind],
    magic: facts.magic,
    rarity: RARITY_LABEL[facts.rarity],
    rarityTint: RARITY_TINT[facts.rarity],
    attunement: facts.attunement,
    damage: weapon?.damage ?? null,
    armorClass: armor?.armorClass ?? null,
    strength: armor?.strength ?? null,
    stealthDisadvantage: Boolean(armor?.stealthDisadvantage),
    weight: facts.weight,
    price: facts.price,
    properties: (weapon?.properties ?? []).map((p) => ({ label: p.label, means: p.means, info: PROPERTIES[p.code] ?? "" })),
    masteries: (weapon?.masteries ?? []).map((m) => ({ name: m.name, means: m.means })),
  };
};

// What each screen shows lives in the package (forge/screens), shared with the
// web. This is only the door: names, and the JSON that crosses it.
const featOptions = (rulesVersion, search) => optionsFor({ prop: "feat", rulesVersion, search, limit: 60 });
// RarityScry of the web: narrowed to the rarities ticked ("none" is bought
// gear), with the web's limits per picker.
const itemOptions = (rulesVersion, search, kind, rarities) =>
  optionsFor({
    prop: "item",
    rulesVersion,
    search,
    limit: kind === "weapon" || kind === "armor" ? 30 : 60,
    weaponsOnly: kind === "weapon",
    armorOnly: kind === "armor",
    ...(Array.isArray(rarities) ? { rarities } : {}),
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
  rulesDoc,
  itemFactsView,
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
