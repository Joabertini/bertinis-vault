/**
 * Build the browsing index the web builder ships with.
 *
 * The index carries only what a picker needs to list, search, sort and filter:
 * enough to render a row and build a Plutonium reference, and nothing else.
 * Full entity text stays out — it is an order of magnitude larger and is only
 * needed once the player opens a single entity.
 *
 * Usage:
 *   node scripts/build-vetools-index.mjs <path-to-5etools-data-dir>
 *
 * The data directory is the one shipped inside Plutonium (`data/`), or any
 * 5etools data checkout with the same layout.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.join(process.cwd(), "packages", "vetools-index", "src", "data");

/** Companion files that repeat entities already present in the source files. */
const SKIP_FILES = new Set(["foundry.json", "roll20.json", "index.json", "sources.json", "fluff-index.json"]);

function readCollection(dataDir, subdir, prop) {
  const dir = path.join(dataDir, subdir);
  const out = [];
  for (const file of fs.readdirSync(dir)) {
    if (SKIP_FILES.has(file) || file.includes("fluff") || !file.endsWith(".json")) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    out.push(...(parsed[prop] ?? []));
  }
  return out;
}

function readFileCollection(dataDir, file, prop) {
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  return parsed[prop] ?? [];
}

/** A source is required to build a reference; magic variants inherit theirs. */
function sourceOf(entity) {
  return entity.source ?? entity.inherits?.source ?? null;
}

/** Spell components come as an object of flags; flatten to "vsm". */
function componentsOf(spell) {
  const c = spell.components ?? {};
  return ["v", "s", "m"].filter((k) => c[k]).join("");
}

const BUILDERS = {
  spell: (entities) =>
    entities.map((s) => ({
      name: s.name,
      source: sourceOf(s),
      level: s.level,
      school: s.school,
      time: s.time?.[0]?.unit ?? null,
      range: s.range?.type ?? null,
      components: componentsOf(s),
      concentration: s.duration?.[0]?.concentration ? 1 : 0,
      ritual: s.meta?.ritual ? 1 : 0,
    })),

  item: (entities) =>
    entities.map((i) => ({
      name: i.name,
      source: sourceOf(i),
      type: i.type ?? null,
      rarity: i.rarity ?? null,
      weight: i.weight ?? null,
      value: i.value ?? null,
      attunement: i.reqAttune ? 1 : 0,
    })),

  feat: (entities) => entities.map((f) => ({ name: f.name, source: sourceOf(f) })),
  race: (entities) => entities.map((r) => ({ name: r.name, source: sourceOf(r), size: r.size?.[0] ?? null })),
  background: (entities) => entities.map((b) => ({ name: b.name, source: sourceOf(b) })),
  class: (entities) => entities.map((c) => ({ name: c.name, source: sourceOf(c) })),
};

function main() {
  const dataDir = process.argv[2];
  if (!dataDir) {
    console.error("Usage: node scripts/build-vetools-index.mjs <path-to-5etools-data-dir>");
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) {
    console.error(`No such data directory: ${dataDir}`);
    process.exit(1);
  }

  const collections = {
    spell: readCollection(dataDir, "spells", "spell"),
    item: [
      ...readFileCollection(dataDir, "items.json", "item"),
      ...readFileCollection(dataDir, "items-base.json", "baseitem"),
    ],
    feat: readFileCollection(dataDir, "feats.json", "feat"),
    race: readFileCollection(dataDir, "races.json", "race"),
    background: readFileCollection(dataDir, "backgrounds.json", "background"),
    class: readCollection(dataDir, "class", "class"),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalGzip = 0;
  const manifest = {};

  for (const [prop, entities] of Object.entries(collections)) {
    const rows = BUILDERS[prop](entities);

    const missing = rows.filter((row) => !row.source);
    if (missing.length) {
      // A row without a source cannot be turned into a reference, so it would
      // be unpickable. Fail rather than shipping an index with dead entries.
      console.error(`${prop}: ${missing.length} entities have no source, e.g. ${missing[0].name}`);
      process.exit(1);
    }

    const json = JSON.stringify(rows);
    const gzip = zlib.gzipSync(Buffer.from(json), { level: 9 }).length;
    totalGzip += gzip;

    fs.writeFileSync(path.join(OUT_DIR, `${prop}.json`), json);
    manifest[prop] = { count: rows.length, bytes: json.length, gzip };

    console.log(
      `${prop.padEnd(11)} ${String(rows.length).padStart(5)} entries  ` +
        `${(json.length / 1024).toFixed(0).padStart(4)}KB raw  ${(gzip / 1024).toFixed(0).padStart(3)}KB gzip`,
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${"".padEnd(11)} ${"".padStart(5)}          total ${(totalGzip / 1024).toFixed(0)}KB gzip`);
}

main();
