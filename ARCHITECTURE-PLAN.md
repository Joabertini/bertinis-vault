# Bertini's Vault — Architecture

## The product

Build a D&D 5e character on the web — on a phone, away from the table, saved to
an account — then import it into Foundry VTT with a short code. Plus a
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

The repository has not moved to those yet: `module.json` declares Foundry 12-13
and the legacy exporter targets dnd5e 5.2.5.

## State of the migration

The legacy Foundry module at the repository root is still the only working
import path. It stays until the reference-based module replaces it.

`packages/data-engine` is a hand-written catalog superseded by
`packages/vetools-index`, but `packages/domain` still depends on it for entity
lookups. Those lookups move first; the package goes afterwards.
