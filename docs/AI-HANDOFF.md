# AI Handoff

Fast start for the next agent working on this repo.

## Read first

1. [`ARCHITECTURE-PLAN.md`](../ARCHITECTURE-PLAN.md) — what the product is and
   how it is built.
2. [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md) — the import path,
   read from Plutonium's own bundle.
3. [`DEPLOY.md`](./DEPLOY.md) — the three pieces and what shipping them needs.

4. [`CHARACTER-MODEL-GAPS.md`](./CHARACTER-MODEL-GAPS.md) — what the builder
   models of a 5e character, what it does not, and in what order that is worth
   fixing.
   [`BUILDER-COVERAGE.md`](./BUILDER-COVERAGE.md) is the same ground viewed
   whole rather than finding by finding: every part of a 5e character, ordered
   by what decides whether the character works, with the build order that falls
   out of it.
5. [`CHARACTER-SHEET-FIELDS.md`](./CHARACTER-SHEET-FIELDS.md) — every field a
   gap fix has to land on, read from the `dnd5e` actor data model itself, with
   which ones `import.js` actually writes today.

Those are current. Treat anything else in this directory as a record of how the
project got here, not as instructions.

[`IMPLEMENTATION-LOG.md`](./IMPLEMENTATION-LOG.md) in particular is a historical
log covering the fabricate-the-item approach that was abandoned. It is kept
because deleting history is worse than keeping it, not because it describes the
current design.

## The one thing to understand

Do not build item documents. Reference them.

Plutonium resolves `{page, source, hash}` into a real `dnd5e` document with
working activities, damage and icons. Hand-built items look right on the sheet
and do nothing when clicked, which is the bug that stalled this project for
months.

## The loop, end to end

```
web builder  →  code  →  worker (KV)  →  Foundry module  →  Plutonium  →  actor
```

Working and verified up to the module. The last two arrows have run twice in a
live world, and both runs found a fault that reading the bundle had missed —
treat anything about them that is not backed by
`test/plutonium-bundle.test.mjs` as a reading, not an observation.

A level 5 wizard is 948 bytes as references. The same character as a fabricated
actor was 37KB, and did not function.

## Where things are

| Path | What |
| --- | --- |
| `apps/web` | The builder. Emits an `ImportPayload`, posts it, shows the code. |
| `apps/worker` | The only backend. Stores a build under a code. |
| `apps/foundry-module` | Reads a code, resolves refs through Plutonium. |
| `packages/contracts` | `CharacterBuild` and `ImportPayload` |
| `packages/vetools-ref` | Reference triples, source registry, 2014/2024 split |
| `packages/vetools-index` | The browsing index, plus `RefResolver` and `buildToPayload` |
| `packages/domain` | 5e rules and derivations |
| `apps/api` | Legacy dataset BFF. Nothing needs it now. |
| `packages/foundry-exporter` | Legacy. Fabricates items. Being replaced. |
| `packages/data-engine` | Legacy hand-written catalog. Superseded. |
| `scripts/`, `templates/`, `styles/` | The legacy root Foundry module |

The legacy root module is still the only import path that has been seen working.
Do not delete it before its replacement has run in a live world.

## What to do next

In order, and stated as what blocks each:

1. ~~**Deploy the worker.**~~ Done. It is live at
   `https://bertinis-vault.bertinisdnd.workers.dev`, backed by the `BUILDS` KV
   namespace, and a build has round-tripped through it. `ALLOWED_ORIGINS` is
   still `*`; narrow it once the builder has a public address. The naive fix
   breaks the module's cross-origin GET from arbitrary Foundry hosts, so it
   needs per-route CORS: open GET, restricted POST.
2. **Run the module in a live world.** Four runs, three wrong fixes, all three
   of them fixing the same wrong half:

   - `isDataOnly` — read by `ImporterBase` and by no other importer, so
     `class`, `subclass` and `feat` ignored it in silence.
   - `isTemp` with no actor — avoids the Charactermancer, windows opened anyway.
   - the converters instead of the importers — correct, and still not enough.

   All three made *building* a document quiet. **The window came from the
   write.** Plutonium registers a `preCreateItem` hook per prop and intercepts
   any item created on an actor that carries its flags — which the converters'
   own documents do. `markAsDirectImport` sets the flag the hook itself checks
   to bail out (`flags.plutonium.isDirectImport`), and that is what closes it.

   The converter route stays, and is still right: no `DataConverter*` class in
   the bundle opens a window, and every importer does. The module reaches
   `importer.constructor._DataConverter` through `pGetImporter` and never calls
   `pImportEntry`. What the Charactermancer would have asked travels as
   converter options (`level`, `proficiencyImportMode`, `isActorItem`).

   Same session: `getPlutoniumApi` now reads `globalThis.plutonium` instead of
   `game.modules.get("plutonium").api`, which Plutonium assigns at the end of
   an un-awaited async `handleReady` — after our own ready hook, so an
   installed Plutonium was being reported as missing at startup.

   `test/plutonium-bundle.test.mjs` asserts all of it against `Bundle.js`
   rather than a fixture — run the gate with `PLUTONIUM_DIR` set or those tests
   skip. `src/window-watch.js` covers the runtime: anything that opens during
   an import is logged with its class, title and stack and reported to the
   player, so the next surprise names itself on the first run.

   Still unobserved, and the reason this item stays open: a full
   `importPayload` run with no prompt appearing for any prop, the class item
   landing at the payload's level, the subclass hash resolving, and whether the
   `dnd5e` skill and language keys the payload carries are the right ones.

   Testing an unmerged branch needs a local install by hand: the module ships
   as a release zip built from `main`, so copy `apps/foundry-module` over
   `Data/modules/bertinis-vault` and reload the world.
3. ~~**Findings B and C in `CHARACTER-MODEL-GAPS.md`.**~~ Done. Class skill
   options and background proficiencies now read from the index
   (`ClassRow.skillChoice`, `BackgroundRow.skillsGranted`/`skillChoice`/
   `toolsGranted`), and the hand-written tables are deleted. What it opened:
   `toolsGranted` now reaches the payload correctly and still goes nowhere once
   it gets there — `import.js` never reads `payload.proficiencies.tools`. See
   `CHARACTER-SHEET-FIELDS.md` and the note at the end of finding C.
4. ~~**Write tool proficiencies onto the actor.**~~ Done. The tool table is
   *generated* from the game system rather than written by hand —
   `scripts/build-tool-ids.mjs` reads `DND5E.tools` out of `dnd5e.mjs` and
   Plutonium's `VALID_TOOL_PROFICIENCIES` out of its bundle, and writes
   `packages/contracts/src/tool-ids.generated.ts`. A dnd5e upgrade that renames
   a key fails a test instead of quietly dropping a proficiency. Regenerate
   with `corepack pnpm tools:ids`.
5. **Move `domain` off `data-engine`.** It imports it only for
   `get*CatalogEntry` lookups, which `vetools-index` supersedes. This touches 24
   passing tests, so it is the highest-risk change left. Finding I — five
   catalog ids that resolve to no item — disappears with it.
6. **Delete `data-engine` and the item fabrication in `foundry-exporter`.** Only
   after 5.
7. **Retire `apps/api`.** The index is bundled; nothing fetches datasets.

### Opened by the 2026-08-26 run, and still open

Three things the build order finished *around* rather than through. None is
large; two of them are blocked on something outside the repo.

8. **Carry starting currency to the payload.** The builder computes it
   correctly — a character who takes the gold, or whose background hands over a
   pouch of 15 gp, has the right number and it is shown. `ImportPayload` has
   nowhere to put it, so the character reaches Foundry with the items and no
   coins. Needs a field on the payload and a line in `import.js`.

9. **Write weapon mastery onto the actor.** The picks are on the build and
   shown in the wizard. **Blocked on a Foundry install**: whether `dnd5e`
   5.3.3 exposes an actor path for mastery has not been verified against the
   real system, and guessing a path would write a field that silently does
   nothing. Check `CONFIG.DND5E` and the actor data model, do not infer.

10. **Run the four manual Foundry validation scenarios.** **Blocked on the
    user**, not on code: they need a live world and a signature.
    `release:ready` fails on the report being pending, which is correct until
    then. See `FOUNDRY-MANUAL-VALIDATION.md`.

The wizard interface is its own track. The design is ours, not a reproduction of
Charactermancer — Plutonium's rules coverage, our interface.

## Where the character model stands

`CHARACTER-MODEL-GAPS.md` is the live account. The short version, so the next
agent knows which half of the problem they are in:

**Answered wrong** — worse than missing, because nothing on the sheet says it
happened. D (weapon and armour lists that correspond to nothing in the rules),
E (Unarmored Defense implemented and never called), I (five equipment ids
resolving to nothing).

**Not answered at all** — attunement and its three slots, carrying capacity,
the identity fields (appearance, age, height, weight, deity), and anything
serving optimisation directly.

**Closed 2026-08-26** — the whole build order in `BUILDER-COVERAGE.md`, items 1
through 9. Nine merged PRs (#32-#40): multiclass prerequisites and what a
second class grants; equipment as A-or-B choices with the gold alternative and
quantities; 2024's origin ability increase, weapon mastery, and spell counts
read from each class's own table; feat prerequisites; subclass spell lists; and
the level-up choices with their pickers. Every one of them replaced a
hand-written table with the structured source, and the deliverable each time
was the conformance test against the real 5etools data rather than the fix.

Three findings that came out of the same work and are worth knowing: a 2024
character was reaching the sheet **three ability points short**, an Eldritch
Knight was offered **no spells at all**, and the index was shipping the literal
string `"[object Object]"` as a weapon mastery property.

**Closed this run** — A (the payload and the module disagreed about slot keys,
skill keys and language keys, and nothing marked equipment worn), F (half-caster
slots undershot at every odd level from 3 up), plus levelling as per-level
decisions, background feat grants, subclass references, and the index carrying
what a character actually needs.

**Closed 2026-08-24** — B (class skills, eight of thirteen classes) and C
(background proficiencies, 13 of 161 covered and four of those wrong), both
moved from the hand-written catalog onto the index.

The thing that changed the working method: `apps/foundry-module/test/conformance.test.mjs`
derives a real build and asserts on what the module produces from it, with no
fixture in between. Every fault in A would have been caught by it. Add to it
rather than to a fixture.

## Verifying

```
corepack pnpm mvp:verify
```

695 tests — 524 under `node --test` and 171 under vitest in the web app — plus
the Foundry fixtures. It must pass from a clean checkout — verify that by deleting every `dist` first, because two
separate bugs have hidden behind stale build output.

Two things worth knowing:

- The generated fixtures under `docs/foundry-validation-fixtures/` are not
  deterministic. Each run produces fresh document ids and a timestamp, so the
  working tree goes dirty after every gate run. That diff is noise.
- `release:ready` fails on the manual validation report being pending. That is
  correct until step 2 above is done.

## Regenerating from Plutonium

Both generated artifacts come from a Plutonium install:

```
node scripts/extract-vetools-sources.mjs <plutonium>/js/Bundle.js <out.mjs>
corepack pnpm vetools:index <plutonium>/data
```

Plutonium's bundle ships unminified, so it can be read directly. That is how the
API surface, the hash algorithm and the source registry were established — not
from documentation, which does not cover them.
