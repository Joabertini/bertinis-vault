/**
 * Build the tool table the builder writes onto a Foundry actor.
 *
 * A tool proficiency is not a name. It is a key on `system.tools` — `thief`,
 * `smith`, `panflute` — and the actor's tool map has no fixed keys, so writing
 * a name creates `system.tools["Smith's Tools"]` and the sheet shows nothing.
 * That is the same failure skills had before `skill-ids.ts`, and it is why the
 * hand-written table this replaces had six ids right out of about forty.
 *
 * Two sources, each authoritative for one half:
 *
 *   - `dnd5e.mjs` (`DND5E.tools`) says which keys exist and which ability each
 *     tool rolls. The system creates the key *and* stamps the ability when it
 *     grants a tool, so both are copied.
 *   - Plutonium's `Bundle.js` (`VALID_TOOL_PROFICIENCIES`) says which 5etools
 *     name maps to which key. It is the mapping a working importer already
 *     uses, which is a stronger warrant than a table written from the books.
 *
 * Usage:
 *   node scripts/build-tool-ids.mjs <dnd5e-system-dir> <plutonium-dir>
 *
 * The output is committed, because neither source belongs in this repository:
 * one is a game system, the other is 6MB of someone else's unlicensed bundle.
 * `packages/contracts/test/tool-ids.test.mjs` checks the committed table
 * against both when the directories are available, and skips when they are not.
 *
 * It lives in `contracts` beside `skill-ids.ts` for the reason stated there:
 * which identifiers a payload may carry is the wire contract's business, not
 * the rules layer's. The Spanish names a player types stay in `domain`.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const OUT = path.join(process.cwd(), "packages", "contracts", "src", "tool-ids.generated.ts");

/**
 * The object literal assigned to `name`, evaluated.
 *
 * Both files ship unminified, so the literal starts at the first `{` after the
 * assignment and ends at its matching `}`. Counting braces rather than
 * matching a regex is what makes a nested `{ability, id}` value safe.
 */
function literalAfter(source, name, context = {}) {
  const at = source.indexOf(name);
  if (at === -1) throw new Error(`no "${name}" in the source — was it renamed?`);

  const open = source.indexOf("{", at);
  let depth = 0;
  let end = -1;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`unbalanced braces after "${name}"`);

  return vm.runInNewContext(`(${source.slice(open, end)})`, { ...context });
}

function readDnd5e(systemDir) {
  const source = fs.readFileSync(path.join(systemDir, "dnd5e.mjs"), "utf8");
  const version = JSON.parse(fs.readFileSync(path.join(systemDir, "system.json"), "utf8")).version;

  return {
    version,
    // `{alchemist: {ability: "int", id: "Compendium…"}, …}`. Only the ability
    // is kept: the compendium id names an item to import, and this builder
    // does not import the tool, only record proficiency in it.
    tools: literalAfter(source, "DND5E.tools = {"),
    /** `art`, `game`, `music` — a kind of tool rather than a tool. */
    toolTypes: literalAfter(source, "DND5E.toolTypes = {"),
    /** `air`, `land`, `space`, `water`, which sit under `vehicle`. */
    vehicleTypes: literalAfter(source, "DND5E.vehicleTypes = {"),
  };
}

function readPlutonium(pluDir) {
  const source = fs.readFileSync(path.join(pluDir, "Bundle.js"), "utf8");

  // The combined table spreads the four grouped ones, so they are evaluated
  // first and handed in as context rather than being re-listed here.
  const context = {};
  for (const group of ["ARTISAN", "GAMING", "MUSICAL", "VEHICLE"]) {
    context[`VALID_TOOL_PROFICIENCIES__${group}`] = literalAfter(
      source,
      `const VALID_TOOL_PROFICIENCIES__${group} = {`,
    );
  }

  return literalAfter(source, "const VALID_TOOL_PROFICIENCIES = {", context);
}

/** Title case that leaves the apostrophes alone: "smith's tools". */
function titleCase(value) {
  return value.replace(/(^|\s|\()([a-z])/g, (_, before, letter) => before + letter.toUpperCase());
}

function main() {
  const [systemDir, pluDir] = process.argv.slice(2);
  if (!systemDir || !pluDir) {
    console.error("Usage: node scripts/build-tool-ids.mjs <dnd5e-system-dir> <plutonium-dir>");
    process.exit(1);
  }

  const dnd5e = readDnd5e(systemDir);
  const byName = readPlutonium(pluDir);

  const categories = new Set([...Object.keys(dnd5e.toolTypes), "vehicle"]);
  const vehicles = new Set(Object.keys(dnd5e.vehicleTypes));

  const rows = [];
  const unknown = [];

  for (const [name, id] of Object.entries(byName)) {
    const tool = dnd5e.tools[id];

    if (tool) {
      rows.push({ name, id, ability: tool.ability, label: titleCase(name), kind: "tool" });
    } else if (categories.has(id) || vehicles.has(id)) {
      // A category has no single ability — which one you roll depends on the
      // tool in your hands — so none is written and the system's own default
      // stands. Inventing one here would be a number nobody in the rules chose.
      rows.push({ name, id, ability: null, label: titleCase(name), kind: "category" });
    } else {
      unknown.push(`${name} -> ${id}`);
    }
  }

  if (unknown.length) {
    // A name mapping to a key the system does not have would write to a path
    // that silently does nothing, which is the whole failure being fixed.
    console.error(`${unknown.length} tools map to keys dnd5e ${dnd5e.version} does not have:`);
    for (const line of unknown) console.error(`  ${line}`);
    process.exit(1);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const entries = rows
    .map((row) => {
      const ability = row.ability ? `, ability: "${row.ability}"` : "";
      return `  ${JSON.stringify(row.name)}: { id: "${row.id}", label: ${JSON.stringify(row.label)}, kind: "${row.kind}"${ability} },`;
    })
    .join("\n");

  const file = `/**
 * Generated by \`scripts/build-tool-ids.mjs\`. Do not edit by hand.
 *
 * Source: dnd5e ${dnd5e.version} (\`DND5E.tools\`) for the keys and abilities,
 * Plutonium's \`VALID_TOOL_PROFICIENCIES\` for the names that reach them.
 *
 * Regenerate with:
 *   node scripts/build-tool-ids.mjs <dnd5e-system-dir> <plutonium-dir>
 */

import type { AbilityId } from "./character-build.js";

/** The dnd5e system this table was read from. */
export const TOOL_TABLE_SYSTEM_VERSION = "${dnd5e.version}";

export type GeneratedToolEntry = {
  /** The key on \`system.tools\`. */
  id: string;
  label: string;
  /**
   * Whether this is one tool or a kind of tool.
   *
   * "Artisan's tools" is a category: the character is proficient with a class
   * of tools rather than a named one, and it has no single ability to roll.
   */
  kind: "tool" | "category";
  /** What the tool rolls, when it is one tool. */
  ability?: AbilityId;
};

/** Every tool proficiency dnd5e has a key for, by its canonical name. */
export const generatedToolsByName: Record<string, GeneratedToolEntry> = {
${entries}
};

const byNormalizedName = new Map<string, GeneratedToolEntry>();
for (const [name, entry] of Object.entries(generatedToolsByName)) {
  byNormalizedName.set(normalize(name), entry);
}

/**
 * A tool name reduced to something two spellings of it share.
 *
 * Apostrophes are dropped rather than replaced, because "smith's tools" and
 * "smiths tools" are the same proficiency and a payload may carry either.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/^tool:\\s*/, "")
    .replace(/['\\u2019]/g, "")
    .replace(/[^a-z0-9()\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

/**
 * The \`dnd5e\` key for a tool name, or null when it has none.
 *
 * A value that is already a key comes back unchanged, so a caller that has
 * done the mapping does not have it undone.
 */
export function toolIdFor(name: string): string | null {
  const normalized = normalize(name);
  if (toolIds.has(normalized)) return normalized;

  return byNormalizedName.get(normalized)?.id ?? null;
}

const toolIds = new Set(Object.values(generatedToolsByName).map((entry) => entry.id));

/** What a tool rolls, when \`dnd5e\` says. Null for a category. */
export function toolAbilityFor(id: string): AbilityId | null {
  const entry = Object.values(generatedToolsByName).find((row) => row.id === id);
  return entry?.ability ?? null;
}
`;

  fs.writeFileSync(OUT, file);
  console.log(
    `${rows.length} tool proficiencies (${rows.filter((r) => r.kind === "tool").length} tools, ` +
      `${rows.filter((r) => r.kind === "category").length} categories) from dnd5e ${dnd5e.version}`,
  );
}

main();
