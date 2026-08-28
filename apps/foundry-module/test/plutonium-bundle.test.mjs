/**
 * What this module assumes about Plutonium, checked against Plutonium.
 *
 * Every fact in `plutonium.js` was read out of `Bundle.js`, and reading is how
 * this project has been wrong three times running. Each attempt drove
 * Plutonium's *importers* with one more option — `isDataOnly`, then `isTemp` —
 * and each time a different window opened in a live world while 300 green tests
 * said the loop was closed. Every one of those tests asserted against a fixture
 * written by the same hand that held the assumption.
 *
 * The module now calls Plutonium's *converters* instead, and these assert the
 * property that makes that safe: converters are pure, importers are not. They
 * cannot prove an import works — only a live world does that — but they fail
 * the moment a Plutonium upgrade moves the ground `documentForRef` stands on.
 *
 * Point `PLUTONIUM_DIR` at an installed Plutonium to run them. Without it they
 * skip, because the bundle is 6MB of someone else's code and does not belong in
 * this repository.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const bundlePath = process.env.PLUTONIUM_DIR ? join(process.env.PLUTONIUM_DIR, "Bundle.js") : null;
const available = Boolean(bundlePath && existsSync(bundlePath));
const skip = available ? false : "set PLUTONIUM_DIR to the directory holding Bundle.js";

const bundle = available ? readFileSync(bundlePath, "utf8") : "";
const lines = bundle.split(/\r?\n/);

/** Anything that opens a window, or asks the user for something. */
const OPENS_A_WINDOW = /pGetUserInput\(|InputUiUtil\$?1?\.|new Dialog\(|DialogV2/;

/**
 * The body of a class in the bundle, by name.
 *
 * The bundle ships unminified with one class per top-level `class X ... {`, so
 * the next top-level `class` declaration ends the previous one.
 */
function classBody(name) {
  const start = lines.findIndex((line) => new RegExp(`^class ${name}\\b`).test(line));
  assert.notEqual(start, -1, `no class "${name}" in the bundle — did Plutonium rename it?`);

  const after = lines.slice(start + 1).findIndex((line) => /^class \w/.test(line));
  return lines.slice(start, after === -1 ? undefined : start + 1 + after).join("\n");
}

/** Every top-level class name in the bundle, paired with its body. */
function* classes() {
  let name = null;
  let body = [];

  for (const line of lines) {
    const match = /^class ([A-Za-z_]\w*)/.exec(line);
    if (match) {
      if (name) yield [name, body.join("\n")];
      name = match[1];
      body = [];
    }
    if (name) body.push(line);
  }

  if (name) yield [name, body.join("\n")];
}

test("no converter in the whole bundle opens a window", { skip }, () => {
  // This is the property the module rests on, and the reason it stopped using
  // the importers. Converters are pure: entity in, document JSON out. If one
  // of them ever grows a prompt, this is where it gets caught.
  const offenders = [];
  for (const [name, body] of classes()) {
    if (!name.startsWith("DataConverter")) continue;
    if (OPENS_A_WINDOW.test(body)) offenders.push(name);
  }

  assert.deepEqual(offenders, [], "a DataConverter now asks the user something");
});

test("the importers, by contrast, are full of windows", { skip }, () => {
  // The control for the test above. If this stops being true, the two are no
  // longer distinguishable and the premise of the whole design has moved.
  assert.match(classBody("ImporterClass"), OPENS_A_WINDOW);
  assert.match(classBody("ImporterFeature"), OPENS_A_WINDOW);
});

test("every importer carries its converter as a static", { skip }, () => {
  // `_DataConverter` on the importer class is the only route to a converter:
  // the public API exposes `pGetImporter`, `ImportOpts` and
  // `ActorMultiImportHelper`, and `globalThis` carries the 5etools shared
  // library but no Plutonium internals.
  const props = {
    ImporterRace: "DataConverterRace",
    ImporterBackground: "DataConverterBackground",
    ImporterFeat: "DataConverterFeat",
    ImporterSpell: "DataConverterSpell",
    ImporterItem: "DataConverterItem",
    ImporterClass: "DataConverterClass",
  };

  for (const [importer, converter] of Object.entries(props)) {
    assert.match(
      classBody(importer),
      new RegExp(`static _DataConverter = ${converter};`),
      `${importer} no longer points at ${converter}`,
    );
  }
});

test("`pGetDocumentJson` is the call for every prop but class", { skip }, () => {
  for (const converter of [
    "DataConverterRace",
    "DataConverterBackground",
    "DataConverterFeat",
    "DataConverterSpell",
    "DataConverterItem",
  ]) {
    assert.match(
      classBody(converter),
      /static async pGetDocumentJson \(/,
      `${converter} no longer implements pGetDocumentJson`,
    );
  }
});

test("class is the exception, and takes the level and proficiency mode as data", { skip }, () => {
  const body = classBody("DataConverterClass");

  // There is no `pGetDocumentJson` here. This is why `isDataOnly` could never
  // have worked for a class even if `ImporterClass` had honoured it.
  assert.doesNotMatch(body, /static async pGetDocumentJson \(/);
  assert.match(body, /static async pGetDocumentJsonClass \(/);
  assert.match(body, /static async pGetDocumentJsonSubclass \(/);

  // `system.levels` comes from `opts.level`, defaulting to 1. This is the
  // question the interactive import opens `Charactermancer_Class_LevelSelect`
  // to ask.
  assert.match(body, /levels: opts\.level \?\?/);

  // And the proficiency mode, which it asks with
  // `Charactermancer_Class_ProficiencyImportModeSelect`. Matching neither
  // branch yields no proficiency advancement at all — no armour, weapon or
  // save proficiencies from the class.
  assert.match(body, /opts\.proficiencyImportMode === Charactermancer_Class_ProficiencyImportModeSelect\.MODE_PRIMARY/);
  assert.match(body, /opts\.proficiencyImportMode === Charactermancer_Class_ProficiencyImportModeSelect\.MODE_MULTICLASS/);

  // A subclass is built from the pair, and re-fetches itself unless told not
  // to. Both are what `documentForRef` relies on.
  assert.match(body, /static async pGetDocumentJsonSubclass \(cls, sc, opts\)/);
  assert.match(body, /if \(!opts\.isScDereferenced\)/);
  assert.match(body, /const identifierCls = UtilDocumentItem\.getNameAsIdentifier\(cls\.name\);/);
});

test("the proficiency mode numbers are the ones this module hard-codes", { skip }, () => {
  // Duplicated into `PROFICIENCY_IMPORT_MODE` because the module ships as plain
  // files with no bundler and cannot import from Plutonium at load time.
  const expected = { MULTICLASS: 0, PRIMARY: 1, NONE: 2 };

  for (const [name, value] of Object.entries(expected)) {
    const pattern = new RegExp(
      `Charactermancer_Class_ProficiencyImportModeSelect\\.MODE_${name} = (\\d+);`,
    );
    const found = bundle.match(pattern);
    assert.ok(found, `MODE_${name} is no longer assigned in the bundle`);
    assert.equal(Number(found[1]), value, `MODE_${name} changed value`);
  }
});

test("`pInit` builds state, not a window", { skip }, () => {
  // `pGetImporter` awaits it, so it runs on every reference we resolve.
  const body = classBody("ImporterBase");
  const at = body.indexOf("async pInit (");
  assert.notEqual(at, -1, "ImporterBase.pInit is gone");

  const pInit = body.slice(at, body.indexOf("\n\t}", at));
  assert.doesNotMatch(pInit, OPENS_A_WINDOW);
  assert.match(pInit, /_folderPathBuilderStateManager/);
});

test("Plutonium intercepts items created on an actor, and `isDirectImport` is the way past", { skip }, () => {
  // This is the one that cost three attempts. The window does not come from
  // building the document — it comes from writing it. Plutonium registers a
  // `preCreateItem` hook per prop, and any item carrying its own flags that
  // lands on an actor is intercepted, the player asked whether to use the
  // importer, and the Charactermancer opened.
  const body = classBody("ImporterBase");
  const at = body.indexOf("_initCreateSheetItemHook (");
  assert.notEqual(at, -1, "the sheet-item hook is gone — check whether the interception still exists");

  const hook = body.slice(at, at + 2000);
  assert.match(hook, /Hooks\.on\("preCreateItem"/);

  // The escape, and the fact that it is checked before anything is opened.
  const escape = hook.indexOf("flags.isStandardDragDrop || flags.isDirectImport) return;");
  const prompt = hook.indexOf("_pGetUseImporterDragDrop");
  assert.ok(escape !== -1, "isDirectImport is no longer an escape from the interception");
  assert.ok(prompt !== -1, "the importer prompt moved");
  assert.ok(escape < prompt, "isDirectImport is no longer checked before the prompt");
});

test("every prop a payload carries is one Plutonium intercepts", { skip }, () => {
  // Recorded so that a prop moving in or out of this set is noticed. The module
  // marks every document regardless, which is what makes it independent of the
  // list — but a change here means Plutonium reorganised the interception and
  // the escape above is worth re-reading.
  const registered = new Set(
    [...bundle.matchAll(/_initCreateSheetItemHook\(\{[\s\S]{0,200}?prop: "(\w+)"/g)].map((m) => m[1]),
  );

  for (const prop of ["race", "class", "subclass", "background", "feat", "item", "optionalfeature"]) {
    assert.ok(registered.has(prop), `Plutonium no longer intercepts "${prop}"`);
  }

  // Spells never prompted, and this is why: no interceptor was ever registered
  // for them.
  assert.ok(!registered.has("spell"), "Plutonium now intercepts spells too");
});

test("`isActorItem` is what keeps the book out of the item's name", { skip }, () => {
  // `findByRef` matches imported items back to their reference by name, so a
  // document named "Fireball (PHB)" silently stops receiving its equipped and
  // prepared state.
  assert.match(
    bundle,
    /static getNameWithSourcePart \(ent, \{displayName = null, isActorItem = false\} = \{\}\)/,
  );
  assert.match(bundle, /!isActorItem && ent\.source && Config\.get\("import", "isAddSourceToName"\)/);
});

test("`globalThis.plutonium` is there before any hook, and `module.api` is not", { skip }, () => {
  // Plutonium assigns the API twice. The global is a top-level statement,
  // evaluated when the bundle loads. `module.api` is assigned by `Api.init()`,
  // which runs at the end of Plutonium's own `ready` handler — after ours,
  // because Foundry fires module hooks in id order and "bertinis-vault" sorts
  // before "plutonium". Reading `module.api` at ready is what reported an
  // installed Plutonium as missing.
  assert.match(bundle, /^globalThis\.plutonium = game\.plutonium = Api\._API;$/m);
  assert.match(bundle, /game\.modules\.get\(SharedConsts\.MODULE_ID\)\.api = Api\._API;/);

  // `Api.init()` sits inside `handleReady`, an async function the ready hook
  // launches without awaiting, with a dozen awaits ahead of it. `module.api`
  // therefore lands some time after every module's ready handler has returned.
  const handleReadyAt = bundle.indexOf("async function handleReady () {");
  const initAt = bundle.indexOf("Api.init();", handleReadyAt);
  assert.ok(handleReadyAt !== -1, "handleReady is gone");
  assert.ok(initAt !== -1, "Api.init() no longer runs inside handleReady");
  assert.match(bundle, /Hooks\.once\("ready", \(\) => \{[\s\S]{0,200}?handleReady\(\)\.catch/);
});

test("`DataLoader` caches classes and subclasses under their prop, not their page", { skip }, () => {
  // Which is why `loadEntity` tries the prop first, and why the parent class of
  // a subclass is fetched with the `class` prop.
  assert.match(bundle, /static PROPS = \["raw_class", "raw_subclass", "class", "subclass"\];/);
  assert.doesNotMatch(bundle, /pCacheAndGet\(UrlUtil\.PG_CLASSES,/);

  // `parentClassOf` builds the class hash from the subclass's own fields.
  assert.match(bundle, /UrlUtil\.URL_TO_HASH_BUILDER\["class"\] = UrlUtil\.URL_TO_HASH_BUILDER\[UrlUtil\.PG_CLASSES\];/);
  assert.match(bundle, /\{name: sc\.className, source: sc\.classSource\}/);
});

/* ------------------------------------------------------- feature items -- */

test("the feature importers exist, and carry the converters this module calls", { skip }, () => {
  // `featureDocumentsFor` reaches a converter the same way `documentForRef`
  // does: `pGetImporter({prop})`, then `_DataConverter` off the class. These
  // three props are the ones it asks for.
  const props = {
    ImporterClassSubclassFeature: "DataConverterClassSubclassFeature",
    ImporterRaceFeature: "DataConverterRaceFeature",
  };

  for (const [importer, converter] of Object.entries(props)) {
    assert.match(
      classBody(importer),
      new RegExp(`static _DataConverter = ${converter};`),
      `${importer} no longer points at ${converter}`,
    );
  }

  // One importer serves both class and subclass features, and is registered
  // under both props — which is what makes asking for either one work.
  const both = classBody("ImporterClassSubclassFeature");
  assert.match(both, /_initCreateSheetItemHook\(\{\s*\n\s*prop: "classFeature",/);
  assert.match(both, /_initCreateSheetItemHook\(\{\s*\n\s*prop: "subclassFeature",/);
  assert.match(classBody("ImportListRaceFeature"), /static get PROPS \(\) \{ return \["raceFeature"\]; \}/);
});

test("the feature converters take `pGetDocumentJson`, like every prop but class", { skip }, () => {
  for (const converter of ["DataConverterClassSubclassFeature", "DataConverterRaceFeature"]) {
    assert.match(
      classBody(converter),
      /static async pGetDocumentJson \(/,
      `${converter} no longer implements pGetDocumentJson`,
    );
  }
});

test("`DataLoader` hands back class features already dereferenced, with their level on them", { skip }, () => {
  // This is why the module filters rather than fetches. The raw data holds
  // `"Arcane Recovery|Wizard||1"` strings; by the time an entity comes out of
  // `pCacheAndGet` they are whole objects, grouped by level.
  assert.match(bundle, /cls\.classFeatures = \[\.\.\.new Array\(Math\.max\(0, \.\.\.Object\.keys\(byLevel\)\.map\(Number\)\)\)\]/);
  assert.match(bundle, /sc\.subclassFeatures = Object\.keys\(byLevel\)/);

  // The two arrays are indexed differently — a class's densely from level 1, a
  // subclass's only over the levels that grant something — so neither index is
  // read. `feature.level` is, and this is where it is set.
  assert.match(bundle, /\(byLevel\[feature\.level \|\| 1\] = byLevel\[feature\.level \|\| 1\] \|\| \[\]\)\.push\(feature\);/);
});

test("the features this module skips are the ones Plutonium skips", { skip }, () => {
  // `Charactermancer_Util.getImportableFeatures`. "Arcane Tradition feature" is
  // a pointer at the subclass feature imported right beside it, and an ASI is
  // on the sheet as the scores themselves.
  const body = classBody("Charactermancer_Util");
  assert.match(body, /if \(f\.gainSubclassFeature && !f\.gainSubclassFeatureHasContent\) return false;/);
  assert.match(body, /case "proficiency versatility": return false;/);
  assert.match(
    classBody("DataPrimerClassSubclassFeature"),
    /_BLOCKLISTED_NAMES_LOWER = new Set\(\[\s*\n\s*"ability score improvement",/,
  );
});

test("a species trait becomes a race feature through `getFauxRaceFeature`", { skip }, () => {
  // A species has no feature list of its own: its traits are the named entries
  // of its own entry list, and this is the call that gives them the `raceName`
  // and `raceSource` the converter reads. 5etools builds its own species
  // feature page the same way, with the same filter.
  assert.match(bundle, /static getFauxRaceFeature \(race, entry\) \{/);
  assert.match(bundle, /\.filter\(ent => ent\.name && ent\.entries\)\s*\n\s*\.map\(ent => DataUtil\.raceFeature\.getFauxRaceFeature\(race, ent\)\)/);
  assert.match(bundle, /^globalThis\.DataUtil = class/m);

  // And the converter reads exactly those two fields back off it.
  assert.match(classBody("DataConverterRaceFeature"), /\$\{feature\.raceName\}\|\$\{feature\.raceSource\}/);
});

test("a subrace entity carries its base race's traits, so the base must not repeat them", { skip }, () => {
  // `_getMergedSubrace` copies the race and appends the subrace's entries to
  // it, overwriting by name where the subrace says so. A hill dwarf entity is
  // therefore the whole dwarf: importing traits from both documents would give
  // the player Darkvision twice.
  const merged = bundle.slice(bundle.indexOf("static _getMergedSubrace"));
  assert.match(merged, /cpySr\.entries\.forEach\(ent => \{/);
  assert.match(merged, /if \(!ent\.data\?\.overwrite\) return cpy\.entries\.push\(ent\);/);
});
