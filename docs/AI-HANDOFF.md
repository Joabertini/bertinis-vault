# AI Handoff

Fast start for the next agent working on this repo.

## Read first

1. [`ARCHITECTURE-PLAN.md`](../ARCHITECTURE-PLAN.md) — what the product is and
   how it is built.
2. [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md) — the import path,
   read from Plutonium's own bundle.
3. [`DEPLOY.md`](./DEPLOY.md) — the three pieces and what shipping them needs.
3b. [`RUTA-POST-BETA.md`](./RUTA-POST-BETA.md) — what the players asked for
   after the beta, what was decided about it, and the order it is being built
   in. The list below is engineering debt; that one is product. When they
   disagree about what to do next, that one is what the owner chose.

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
6. [`PORTABILIDAD.md`](./PORTABILIDAD.md) — what in this repository can run
   outside a browser, and the rule that keeps it that way. The downloadable
   product depends on it and cannot enforce it from its own repository.

Those are current. Treat anything else in this directory as a record of how the
project got here, not as instructions.

A document that narrates rather than asserts now says so in its own first
lines, with a closing date: `MIGRACION-FRONT.md`, `IMPLEMENTATION-LOG.md`,
`ENVIRONMENT-GUIDE.md`, `FOUNDRY-VALIDATION-MATRIX.md` and
`FOUNDRY-VALIDATION-BASELINE.md` are records. The rule is in
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).

[`IMPLEMENTATION-LOG.md`](./IMPLEMENTATION-LOG.md) in particular is a historical
log covering the fabricate-the-item approach that was abandoned. It is kept
because deleting history is worse than keeping it, not because it describes the
current design.

## The rule that costs the most when it is forgotten

**Change `ImportPayload`, deploy the Worker.**

`importPayloadSchema.safeParse` strips what it does not know and answers 200.
A Worker older than the contract therefore discards new fields in silence, and
every layer reports success: the builder computed it, the store accepted it,
the module wrote what it received.

On 2026-09-01 the deployed Worker was from 23 August while `main` was twenty
pull requests ahead. It was throwing away **20 of 73 fields** — every
appearance field, armour and weapon proficiencies, weapon masteries, tool
expertise, all five currency denominations, and `optionalFeatures`. That last
one carries fighting styles, invocations, the pact boon, metamagic, maneuvers,
runes and infusions, so a warlock reached the table with no invocations and
the sheet looked ordinary. A week of bugs that read as faults in the builder
and in the module were this.

The guard is `apps/web/probes/store-fidelity.ts`. It round-trips a payload
through the live store and names every field that does not come back. Run it
after any change to the payload and after any deploy:

```
corepack pnpm exec vite build --ssr probes/store-fidelity.ts --outDir .probe
node .probe/store-fidelity.js
```

No unit test can see this. They check the builder against the contract in this
repository, which is current by definition; only a round trip shows that the
deployment is not.

The same applies to the module. A copy installed in Foundry keeps its version
number while its code falls behind. Compare the files, never the versions:

```
git hash-object "<FoundryData>/modules/bertinis-vault/src/import.js"
git rev-parse HEAD:apps/foundry-module/src/import.js
```

On 2026-09-01 those two differed and the installed copy turned out to be the
**exact blob of PR #58** — four pull requests of fixes that had been merged to
`main` and never reached a table: #59 (attunement), #65 (stop granting Tasha's
optional class features for free), #70 (name the item Foundry rejected) and
#71 (keep an item whose damage cannot be rolled). To find which pull request an
old copy corresponds to, walk the blobs:

```
git log --format=%h -- apps/foundry-module/src/import.js
```

**Installing the module is part of merging a pull request that changes it.**

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

1. ~~**Deploy the worker.**~~ Done, and it answers to two names: its own
   `api.bertinilabs.xyz`, which is what lets a session cookie exist at all, and
   `bertinis-vault.bertinisdnd.workers.dev`, which every installed module and
   the deployed builder still ask for a build. `workers_dev = true` is declared
   in `wrangler.toml` and is load-bearing — adding a route turns it off by
   default, and doing so took the store offline for both until it was put back.

   `ALLOWED_ORIGINS` keeps the wildcard **and** names the site:
   `"*,https://alba.bertinilabs.xyz"`. The two do different jobs. The name is
   what lets a page hold a session, because a browser sends a cookie
   cross-origin only when the response names the caller exactly and allows
   credentials. The wildcard is what lets a Foundry world on any host read a
   build, where the code is the credential. Dropping the wildcard — which is
   what "stop using `*`" sounds like it means — leaves `corsHeaders` answering
   every unnamed origin with the first entry in the list, and every Foundry
   install stops importing.
2. ~~**Run the module in a live world.**~~ Done, repeatedly, on Foundry v14.367
   with `dnd5e` 5.3.3 and Plutonium installed. A character built in the web
   app, published to the Worker and imported by code arrives with no prompt of
   any kind, resolves real compendium documents — `system.identifier` populated,
   real books, spells with working activities — and lands at the payload's
   level with the right skill and language keys. The history is kept because
   the three wrong fixes below are still the fastest way to understand why the
   converter route is the right one:

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

   Testing an unmerged branch needs a local install by hand: the module ships
   as a release zip built from `main`, so copy `apps/foundry-module` over
   `Data/modules/bertinis-vault` and reload the world. Do this before trusting
   any live result — an installed copy keeps its version number while its code
   falls behind.
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

### Closed on 2026-09-01

8. ~~**Carry starting currency to the payload.**~~ Done, and seen on a real
   sheet: ten gold pieces arrived in the bag. It had been computed correctly
   all along and discarded by the deployed store — see the rule at the top.

9. ~~**Write weapon mastery onto the actor.**~~ Done. `dnd5e` 5.3.3 keeps it at
   `traits.weaponProf.mastery.value`, a Set consulted with
   `.has(item.type.baseItem)`, so it holds base-item ids — `longsword`, never
   "Longsword" and never the mastery property. Read from the installed
   `dnd5e.mjs`, not inferred.

10. **The four manual validation scenarios test a path that is being retired.**
    The fixtures under `docs/foundry-validation-fixtures/` are fabricated
    actors from the legacy `foundry-exporter`, and they declare
    `foundryVersion: 13.351`, `systemVersion: 5.2.5`. The module cannot consume
    one: its only entry is `importByCode`, which fetches a reference payload
    from the Worker. Running them proves nothing about what ships.

    The rehearsal that does is `apps/web/probes/rehearsal.ts` — it builds a
    character, publishes it, and prints the code to type into a live world.
    `release:ready` still gates on the pending report, which is now gating on
    the wrong thing and is worth fixing before it teaches anyone to override it.

### The one bug behind several

An imported actor is **assembled**; a Charactermancer-built one is **levelled**.
Compared side by side against a hand-built paladin: his class item carries
`HitPoints` and five `ItemGrant` advancements, his subclass one more, and he
has twenty-six separate feature items. Ours has none of those, and `import.js`
writes twelve `system.*` fields by hand instead.

Every open defect of that shape — features arriving as one item instead of
several, proficiencies that a `Trait` advancement would have applied, hit
points the class item cannot re-roll on level-up — is the same bug: the
advancement system is being re-implemented one field per bug report.

`dnd5e` 5.3.3 exposes the machinery: `AdvancementManager.forNewItem(actor,
itemData, options)`, `.forLevelChange(actor, classId, levelDelta, options)`,
and `apply(level, data)` on every advancement type. `AdvancementManager` is a
UI class, so whether it can be driven headlessly is the question — and it is
one experiment, not a rewrite. Establish it in a live world before believing
it; the window problem taught that lesson three times.

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

508 under vitest in the web app, 90 in the Foundry module, 44 in the Worker,
plus the rest under `node --test` and the Foundry fixtures. It must pass from a
clean checkout — verify that by deleting every `dist` first, because two
separate bugs have hidden behind stale build output.

The module's data-backed tests skip without `PLUTONIUM_DIR`. Set it to the
directory holding `Bundle.js` and they read the real 5etools data rather than a
fixture, which is the point: a fixture records what we believed the data said.

Four things worth knowing:

- The generated fixtures under `docs/foundry-validation-fixtures/` are not
  deterministic. Each run produces fresh document ids and a timestamp, so the
  working tree goes dirty after every gate run. That diff is noise.
- `release:ready` fails on the manual validation report being pending, and that
  report covers a path that is being retired. See item 10.
- The web suite runs on the `threads` pool, set in `apps/web/vitest.config.ts`.
  `forks` boots a Node process per worker, which on a disk that gives 18 IOPS
  outran the pool's patience: the gate went red with every test passing and one
  suite that never started. Threads finished it in half the time.
- **The gate cannot see a stale deployment.** Everything here checks the
  builder against the contract in this repository, which is current by
  definition. Read the rule at the top of this file.

## Regenerating from Plutonium

Both generated artifacts come from a Plutonium install:

```
node scripts/extract-vetools-sources.mjs <plutonium>/js/Bundle.js <out.mjs>
corepack pnpm vetools:index <plutonium>/data
```

Plutonium's bundle ships unminified, so it can be read directly. That is how the
API surface, the hash algorithm and the source registry were established — not
from documentation, which does not cover them.
