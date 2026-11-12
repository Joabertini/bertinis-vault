# Bertini's Vault — Architecture

## The product

Build a D&D 5e character on the web — in a browser, away from the table, saved
to an account — then import it into Foundry VTT with a short code. Plus a
cheatsheet for playing the character.

Pathbuilder 2e is the shape to aim at.

Note what this is not. Building a character *inside* Foundry is already solved:
Plutonium ships Charactermancer, a complete in-Foundry creator. The gap this
product fills is everything that happens away from the virtual tabletop.

## Where the data comes from

Plutonium, the 5etools integration for Foundry, is the anchor of the import
path. It ships the full 5etools dataset and converts 5etools entities into real
`dnd5e` documents.

That single fact removes most of what a character builder would otherwise have
to own: item modelling, activities, damage parts, icons, and a content catalog.

See [docs/PLUTONIUM-INTEGRATION.md](./docs/PLUTONIUM-INTEGRATION.md) for the API
surface and the version matrix, read from the distributed bundle.

### Why the previous approach failed

The exporter used to fabricate item bodies by hand. A spell it produced fell
back to a default school, default components, a generic icon, and carried no
activities at all. It appeared on the character sheet and did nothing when
clicked. No amount of refining that code path would have fixed it, because the
information simply was not there to fabricate from.

## The principle

**Reference entities, never fabricate them.**

A character build travels as a list of `{page, source, hash}` references plus
the state that is genuinely character-specific — quantities, equipped, prepared,
class levels. The Foundry module resolves each reference through Plutonium,
which returns the real document.

The payload is kilobytes instead of megabytes, and fidelity is not our problem
to solve, because we are not the ones building the item.

## Layers

| Layer | Responsibility |
| --- | --- |
| `apps/web` | The builder wizard, the character sheet, accounts |
| `apps/foundry-module` | Fetch a build by code, resolve refs through Plutonium, create the actor |
| `packages/vetools-ref` | The `{page, source, hash}` triple and the source registry |
| `packages/vetools-index` | The browsing index the wizard queries |
| `packages/contracts` | `CharacterBuild` and shared schemas |
| `packages/domain` | 5e rules: derivations, spell progression, proficiencies |

## Data, and where it lives

Measured, then decided:

| | gzip |
| --- | --- |
| Browsing index, all categories | 47KB |
| Full entity text, all categories | 1.0MB |

The index ships with the app. At 47KB there is no tradeoff worth weighing, and
browsing stays instant and offline. Full entity text is fetched per category
when a wizard step needs it, and cached.

**No server serves content.** The only backend is the one that stores a build
and returns it by code.

## The code

A build is saved server-side and addressed by a short code, in the shape
Plutonium's own Rivet integration already uses (`LOBO4821`). The player types it
into the Foundry module, which fetches the build and imports it.

Storage is Cloudflare D1 for accounts and builds, KV for the short-lived codes.

## Rulesets

The player chooses 2014 or 2024 when creating a character. Most content exists
in both editions under different sources, and therefore different hashes.

5etools classifies editions by release date rather than by a list: a source is
2014 if it predates the 2024 Player's Handbook. `packages/vetools-ref`
reproduces that rule, so new releases classify themselves.

A build must never be offered content from the other edition. Mixing them
produces a character that imports cleanly and plays wrong, which is worse than
one that fails loudly.

## Interface

The wizard is our own design, not a reproduction of Charactermancer. We take
Plutonium's rules coverage; the interface is where this product competes.

## Constraints

Plutonium `2.17.2` requires:

- Foundry VTT v14
- dnd5e system 5.3.x
- lib-wrapper

`apps/foundry-module/module.json` targets those, and a live install confirms
them: **Foundry v14.367, dnd5e 5.3.3**, with Plutonium and lib-wrapper present.

Two manifests still carry the id `bertinis-vault`: the one above, and the
legacy `module.json` at the repository root, which declares Foundry 12-13 and
loads `scripts/vault.js`. Only the first is the import path.

## State of the migration

The reference-based module is the import path and has been since 2026-08-24,
when it created its first actors. What remains is removal, not replacement:

| Piece | Why it is still here |
| --- | --- |
| Legacy root module (`module.json`, `scripts/`, `templates/`, `styles/`) | Nothing depends on it; it has simply not been taken out |
| `packages/data-engine` | `packages/domain` still uses it for entity lookups. Those lookups move to `vetools-index` first — high risk, 24 tests |
| `packages/foundry-exporter` | Fabricates item bodies, the approach this design replaced. Depends on `data-engine` |
| `apps/api` | Content BFF. No server serves content any more, so it has no job |

Retiring them is deliberate open work, not an oversight. It comes after the
live validation pass, because it touches everything the pass exercises.

## Relationship to El Faro del Alba

`Joabertini/Faro-del-alba` is the downloadable, local-first track: a Tauri
desktop application with its own rules engine and content ingestion, aimed at
more than one game system. It is a separate repository and a separate product.

The split is deliberate, and its terms are set by that repository's
`ADR-0001`: the two converge **through explicit shared contracts and portable
engines, never by synchronising whole applications**. Faro's own rule — "the
rules/domain core must not depend on Tauri, React or browser APIs" — is the one
that reaches back into this repository.

What that means here, in practice:

- Everything under `packages/` stays free of browser APIs. It already is; see
  [docs/PORTABILIDAD.md](./docs/PORTABILIDAD.md) for the measurement and the
  command that repeats it.
- Offline operation, local files, installed content packages and local AI are
  **not goals of this product**. They are the reason the desktop track exists.
- New 5e rules logic belongs in `packages/forge`, not in `apps/web/src/lib`, so that
  the desktop track can take it without taking React with it.
