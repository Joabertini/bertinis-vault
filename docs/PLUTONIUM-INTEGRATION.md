# Plutonium Integration

Research notes taken from Plutonium `2.17.2.v14`, read directly from the
distributed module (`js/Bundle.js`, which ships unminified).

Manifest: `https://github.com/TheGiddyLimit/plutonium-next/releases/latest/download/module.json`

## Why this matters

Plutonium is the anchor of the import path. It ships the full 5etools dataset
(~117 MB under `data/`), and it converts 5etools entities into real `dnd5e`
documents. Anything we resolve through Plutonium arrives with correct
activities, damage parts, icons, and metadata — none of which we have to model
ourselves.

This replaces the previous approach in `packages/foundry-exporter`, which
fabricated item bodies by hand and produced items that existed on the actor but
did not function.

## Hard version constraints

Plutonium `2.17.2` declares:

| Dependency | Range |
| --- | --- |
| Foundry VTT | minimum `14`, verified `14.365`, maximum `14.999` |
| dnd5e system | minimum `5.3.0`, verified `5.3.3`, maximum `5.3.999` |
| lib-wrapper | minimum `1.13.0.0` (required) |

Our `module.json` currently declares Foundry `12`–`13`, and the exporter targets
dnd5e `5.2.5`. Both are outside Plutonium's supported range and must move.

Targeting dnd5e 5.3.x also resolves two schema breaks we would otherwise have to
handle: `advancement` became an object rather than an array, and `senses` moved
to `attributes.senses.ranges`. Since Plutonium builds the items, we no longer
emit those shapes at all.

## Public API

Plutonium assigns its API in the standard Foundry place:

```js
game.modules.get("plutonium").api
```

The parts relevant to character import:

```js
api.importer.pGetImporter({page, prop})   // importer for any entity type
api.importer.spell.pImportEntry(entry, opts)
api.importer.creature.pImportEntry(entry, opts)
api.importer.ActorMultiImportHelper       // batches many imports onto one actor
api.importer.ImportOpts                   // import options object
api.hooks.on / api.hooks.off
```

`api_pImportEntry` accepts:

```js
static async api_pImportEntry (entry, {
  actor = null,
  isTemp = false,
  packId = null,
  actorMultiImportHelper = null,
  availableProficiencyManager = null,
} = {})
```

It throws if `game.user.role` is below the configured `import.minimumRole`.

## Entity identity: the `{page, source, hash}` triple

Plutonium resolves entities through:

```js
const entity = await DataLoader.pCacheAndGet(page, source, hash);
```

where `page` is the 5etools page (`spells.html`, `items.html`, …), `source` is
the book code (`PHB`), and `hash` is the 5etools URL hash
(`encodeURIComponent(name.toLowerCase())_source.toLowerCase()`).

`packages/foundry-exporter` already builds exactly this triple in
`buildPlutoniumSpellReference()`, but only for spells, with hashes derived from
a guessing fallback rather than real data, and it stores the result in
`flags.plutonium` of a hand-built item, where nothing reads it.

The triple is the right identifier. It needs to cover every category and be
sourced from real 5etools data.

## Two inbound channels, both read from source

### 1. Drop event

```js
window.addEventListener("drop", evt => {
  const data = EventUtil.getDropJson(evt);
  if (data.type !== VeCt.DRAG_TYPE_IMPORT) return;
  const {page, source, hash} = data;
  this._pHandleImportEntityDrop({page, source, hash});
});
```

`VeCt.DRAG_TYPE_IMPORT` is the string `"ve-Import"`.

### 2. Rivet

Rivet is a browser extension bundled inside the module itself
(`rivet.zip`, `rivet_chrome.zip`). Its protocol:

1. The web page dispatches a DOM event:
   `window.dispatchEvent(new CustomEvent("rivet.send", {detail: packet}))`
2. Rivet's content script forwards it to the extension background.
3. The background finds every tab whose pathname ends in `/game` — i.e. any
   running Foundry instance — and messages it.
4. The content script in the Foundry tab re-dispatches it as
   `window.dispatchEvent(new CustomEvent("rivet.receive", {detail: packet}))`
5. `RivetBridge.init()` in Plutonium handles it.

Packet shape for entity import:

```js
{
  type: "entity",
  data: {entity, page, options, isTemp},
  settings: {isWhisper, isSendRolls},
}
```

Handled packet types: `roll`, `entity`, `currency`, `5etools.lootgen.loot`,
`5etools.blocklist.excludes`, `5etools.encounterbuilder.encounter`.

Rivet requires the sending page and the Foundry tab to be open in the same
browser. That constraint does not apply to us, because we ship our own module
and can `fetch()` a build by ID directly.

### Import target

Rivet imports into whatever document is configured as the target:

```js
Config.setRivetTargetDocument({actor})  // or {pack}
```

stored as `rivet.targetDocumentId` (an actor UUID or `Compendium.<id>`).

## Charactermancer

Plutonium contains a full in-Foundry character creator — 63 `Charactermancer*`
classes covering ability score selection, class and level selection, proficiency
management, additional spells, equipment, backgrounds, and feats.

There is no entry point for loading a saved character into it: no
`pLoadCharacter`, `importCharacter`, or `pApplyToActor` exists in the bundle. It
is UI-driven.

The consequence for us is a scoping one. Building a character *inside Foundry*
is solved. What is not solved, and what this product is actually for, is
building one **outside** Foundry — on a phone, away from the table, saved to an
account — and then getting it in. That is the Pathbuilder shape, and it is the
part worth building.

## Resulting shape of our import

1. The web builder produces a `CharacterBuild`.
2. It is saved server-side and addressed by a short ID.
3. Our module fetches the build by ID.
4. It creates the actor shell (name, abilities, HP).
5. For each referenced entity it calls
   `api.importer.pGetImporter({prop})` and `pImportEntry(entry, {actor,
   actorMultiImportHelper})`, batching through one `ActorMultiImportHelper`.
6. `await actorMultiImportHelper.pDoFinalize()`.

The payload crossing the wire becomes a list of `{page, source, hash}`
references plus character-specific overrides — kilobytes, not megabytes — and no
item is ever fabricated by us.

## Licensing, and why we do not fork

Plutonium's `module.json` declares `"license": "UNLICENSED"` and points its
`url` at a Patreon. All rights reserved: no permission is granted to copy,
modify or redistribute it. `TheGiddyLimit/plutonium-next` is a distribution
repository — releases, manifest, changelog — not a source release.

So forking it, vendoring it, or adapting its code into this module is not an
option, however convenient it would be. The separate and larger problem is
`data/`: 117MB of 5etools content, which is not Plutonium's to relicense and
not ours to redistribute either. Every user brings their own copy, which is
also why regenerating the index points at a local Plutonium install rather
than at anything committed here.

What *is* fine is what we already do: calling a module's runtime API from
another module, and reading the shipped bundle to learn that API. That is
ordinary Foundry module interop. The line is redistribution, and we stay well
clear of it.

## Getting a document without the Charactermancer

The interactive path is not the only one, but the door is not the obvious one.

### The wrong door: `isDataOnly`

`ImportOpts` takes `isDataOnly`, documented as "If this import should simply
return the data, rather than import anything", and the base importer honours it
before it touches the actor:

```js
// ImporterBase._pImportEntry, ~line 95697 of the 2.17.2 bundle
await this._pImportEntry_preImport({ent, importOpts, dataOpts});

if (importOpts.isDataOnly) {
    return new ImportSummary({
        status: ConstsTaskRunner.TASK_EXIT_COMPLETE_DATA_ONLY,
        imported: [new ImportedDocument({
            document: await this.constructor._DataConverter.pGetDocumentJson(ent, {...}),
            actor: importOpts.actor,
        })],
        ...
```

This module shipped on that reading, and the Charactermancer opened anyway. The
flag is read in `ImporterBase._pImportEntry` **and nowhere else in the bundle**,
and two of the importers a character payload goes through override that method:

| Importer | Line | With an actor in `ImportOpts` |
| --- | --- | --- |
| `ImporterClass` | ~145021 | branches on `isTemp`, then `actor`. Never reads `isDataOnly`. Goes to `_pImportEntryClass_pImportToActor` — the level picker, the proficiency-mode prompt, the HP-mode prompt, the spell modal |
| `ImporterFeature` (so `ImporterFeat`) | ~129943 | falls back to the base importer only when there is **no** actor, or when `isLeaf` is set. Otherwise runs the advanced flow, which opens `Charactermancer_FeatureOptionsSelect` |

`DataConverterClass` has no `pGetDocumentJson` either — it has
`pGetDocumentJsonClass` and `pGetDocumentJsonSubclass`, with different
signatures. The flag would have had nothing to call even if `ImporterClass` had
read it.

So `race`, `subrace`, `background`, `spell` and `item` obeyed the flag, and
`class`, `subclass` and `feat` ignored it in silence. Nothing reported an error;
the import simply became interactive again.

### The second wrong door: `isTemp`

`isTemp` does avoid the Charactermancer. `ImporterClass._pImportEntryClass` and
`_pImportEntrySubclass` both test it *before* `actor`, so they take
`_pImportToItems`; `ImporterBase` returns a temporary document before any world
write; `_getDuplicateMeta_getExisting` bails out under it. All of that is true,
and a live run still opened windows.

The lesson is not which flag to try next. **The importers are the interactive
layer.** They are the UI. Every one of them is built around asking, and no
combination of options turns that off, because turning it off was never a use
case Plutonium had. Two attempts were spent looking for a quiet way through a
thing whose job is to not be quiet.

### The door: the converters, directly

Underneath every importer is a `DataConverter`, and the converters are pure
functions. Entity in, finished `dnd5e` document JSON out — with activities,
damage parts, side-loaded effects and a real icon, which is the entire reason
this project resolves references instead of fabricating items.

**No `DataConverter*` class in the bundle calls `pGetUserInput`, `InputUiUtil`,
`Dialog` or `DialogV2`.** Not one. That is a structural property, not a lucky
reading, and `test/plutonium-bundle.test.mjs` asserts it over every converter
class in the file.

So the module skips `pImportEntry` entirely:

```js
const importer  = await api.importer.pGetImporter({prop, page});
const converter = importer.constructor._DataConverter;

// every prop but class
await converter.pGetDocumentJson(entity, {...dataOpts});

// class, which has no pGetDocumentJson at all
await converter.pGetDocumentJsonClass(cls, {level, proficiencyImportMode});

// subclass, which is built from the pair
await converter.pGetDocumentJsonSubclass(cls, sc, {isScDereferenced: true});
```

`pGetImporter` is still the way in — `_DataConverter` is a static on the
importer class, and the public API exposes no other door — but only `pInit`
runs, and `pInit` builds a folder-path state manager and shows nothing.

No actor is passed. The converters use it only to name an actor item
differently from a world one, and passing it turns on `isActorItem` branches we
have no use for.

A subclass needs its class alongside it: the class supplies the name the
identifier derives from, the edition it is checked against, and the image
fallback. `DataLoader` has it under the `class` prop, and the subclass entity
carries `className` and `classSource`, so `parentClassOf` builds the hash from
those two fields.

`isActorItem: true` goes on every call. It is not cosmetic: without it the
converters append the book to the name — "Fireball (PHB)" — and `findByRef`
matches imported items back to their reference by name, so equipped and
prepared state would stop landing.

### The half that was actually opening the window

All of the above makes *building* a document silent, and for three attempts
that was the whole search. The window was never coming from the build.

Plutonium registers a `preCreateItem` hook **per prop** —
`ImporterBase._initCreateSheetItemHook`, registered by `class`, `subclass`,
`race`, `background`, `feat`, `item` and `optionalfeature`, which is every prop
a character payload carries except `spell`. Any item created on an actor
carrying Plutonium's own flags is intercepted:

```js
Hooks.on("preCreateItem", (item, itemData, options, itemId) => {
    if (item.parent?.documentName !== "Actor") return;
    const flags = itemData.flags?.[SharedConsts.MODULE_ID];
    if (!flags || flags?.propDroppable !== prop) return;
    if (flags.isStandardDragDrop || flags.isDirectImport) return;
    ...
    this._pGetUseImporterDragDrop(...)   // "use the importer?" — then the Charactermancer
```

The documents the converters build carry `flags.plutonium.propDroppable`,
because they *are* Plutonium's documents. So every write triggered the
interception, no matter how the document had been built.

The hook's own escape is the last of those guards, and `markAsDirectImport`
sets it on every document before `createEmbeddedDocuments`. Three of the
converters set it themselves from `isActorItem`; setting it explicitly covers
the rest and does not depend on which.

### Reading the API without a race

Plutonium assigns its API twice:

- `globalThis.plutonium = game.plutonium = Api._API;` — a top-level statement,
  evaluated when the bundle loads, before any hook.
- `game.modules.get("plutonium").api = Api._API;` — inside `Api.init()`, which
  runs near the end of `handleReady`, an async function Plutonium's `ready`
  handler launches without awaiting.

Foundry fires module hooks in id order, and `bertinis-vault` sorts before
`plutonium`, so reading `module.api` at ready finds nothing. That is what
reported an installed, active Plutonium as missing. `getPlutoniumApi` reads the
global.

### Answering, instead of being asked

What the interactive path prompts for travels as converter options. The third
argument to `pImportEntry` is `dataOpts`, and it reaches the converter
untouched:

| Option | Replaces the prompt from | Effect |
| --- | --- | --- |
| `level` | `Charactermancer_Class_LevelSelect` | `system.levels` on the class item (`levels: opts.level ?? 1`) |
| `proficiencyImportMode` | `Charactermancer_Class_ProficiencyImportModeSelect` | `1` = primary class, `0` = multiclass, `2` = none |

`proficiencyImportMode` is not optional. `_getClassAdvancements` compares it
against both constants and falls to `{}` when it is unset, building the class
with no proficiency advancement at all — no armour, weapon or save
proficiencies from the class.

`DataLoader` is also stricter than it looks: it caches under the **prop**
always, and under the page only for props in `_PROP_TO_HASH_PAGE`. `subclass`
is not one of them, which is why Plutonium's own code calls
`pCacheAndGet("subclass", ...)` and never `pCacheAndGet(UrlUtil.PG_CLASSES, ...)`.
`loadEntity` tries the prop first for that reason.

Every prop we import has a converter behind that path:

| Prop | Converter |
| --- | --- |
| `race`, `subrace` | `DataConverterRace`, `DataConverterRaceFeature` |
| `class`, `subclass` | `DataConverterClass`, `DataConverterClassSubclassFeature` |
| `background` | `DataConverterBackground`, `DataConverterBackgroundFeature` |
| `feat` | `DataConverterFeat` |
| `spell` | `DataConverterSpell` |
| `item` | `DataConverterItem` |
| `optionalfeature` | `DataConverterOptionalfeature` |

The last row is the one that closes finding J: Fighting Style, Metamagic and
Eldritch Invocations are `optionalfeature` entities, and there is a converter
for them. Once the builder asks those questions, the module can convert the
answers directly instead of letting Plutonium ask again.

Note what this path does *not* give us for free. Everything the importer
applied as an actor update rather than as an item — racial ability bonuses,
proficiency grants, senses, size, speed — becomes ours to apply. That is the
point rather than a cost: those are exactly the values arriving twice today.

The `DataConverter*` classes are module-scoped and not reachable directly —
`globalThis` carries the 5etools shared library (`DataLoader`, `Renderer`,
`Parser`, `UrlUtil`, `DataUtil`, `MiscUtil`) but no Plutonium internals, and
the public `api` exposes only `pGetImporter`, `ImportOpts` and
`ActorMultiImportHelper`. Going through `pGetImporter` is therefore not a
workaround; it is the only supported door.

## What holds these readings in place

`apps/foundry-module/test/plutonium-bundle.test.mjs` asserts the claims on this
page against `Bundle.js` itself: that no converter in the file opens a window
and that the importers do, that every importer still carries its converter as
`_DataConverter`, that the class converter reads `opts.level` and
`opts.proficiencyImportMode`, that `pInit` builds state rather than UI, and that
the mode constants still have the values this module hard-codes.

`apps/foundry-module/src/window-watch.js` is the runtime half. It patches
`Application.render` and `ApplicationV2.render` for the duration of an import
and logs the class, title and stack of anything that opens, so a window that
should not be there names itself the first time instead of costing a round
trip.

Run it with `PLUTONIUM_DIR` pointed at an installed Plutonium; without it the
tests skip, because a 6MB copy of someone else's bundle does not belong in this
repository. It cannot prove an import works — only a live world does that — but
it fails the moment a Plutonium upgrade moves the ground the module stands on,
which is the failure the `isDataOnly` attempt had no way to see coming.

## Open, needs a live Foundry

Everything on this page is read from source. One live run has happened: it
found K, and disproved the `isDataOnly` reading above. Still unobserved:

- `pGetImporter({prop})` returns importers for `race`, `class`, `background`,
  `feat`, and `item`, not only `spell`;
- a full `importPayload` run start to finish, with no prompt appearing at any
  point, for `class`, `subclass`, `background` and `feat` alike;
- the class item lands at the level the payload asked for, and its
  `system.advancement` covers every level up to it;
- the subclass hash resolves through `pCacheAndGet("subclass", ...)`;
- the `dnd5e` skill and language keys the payload carries are the ones the
  sheet reads.
