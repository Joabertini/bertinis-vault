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

## Open, needs a live Foundry

Everything above is read from source, not observed at runtime. Before building
against it, confirm in a live world with Plutonium active:

- `game.modules.get("plutonium").api` is populated at the point our module runs;
- `pGetImporter({prop})` returns importers for `race`, `class`, `background`,
  `feat`, and `item`, not only `spell`;
- `ActorMultiImportHelper` behaves as expected across a full multi-entity build;
- the `availableProficiencyManager` default does the right thing when we do not
  supply one.
