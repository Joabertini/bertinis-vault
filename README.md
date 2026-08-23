# Bertini's Vault

Build a D&D 5e character on the web, then import it into Foundry VTT with a
short code.

Building a character inside Foundry is already solved — Plutonium ships a
complete in-Foundry creator. This is for everything away from the table: on a
phone, saved to an account, with a cheatsheet for actually playing.

## How the import works

A build travels as a list of 5etools references, not as character data. The
Foundry module resolves each reference through [Plutonium](https://5e.tools),
which returns the real `dnd5e` document — with working activities, damage and
icons, because we never build the item ourselves.

- [ARCHITECTURE-PLAN.md](./ARCHITECTURE-PLAN.md) — the design
- [docs/PLUTONIUM-INTEGRATION.md](./docs/PLUTONIUM-INTEGRATION.md) — the import path
- [docs/AI-HANDOFF.md](./docs/AI-HANDOFF.md) — start here if you are picking this up

## Layout

```
apps/web              the builder wizard
apps/api              legacy dataset BFF, being retired
packages/vetools-ref    reference triples, sources, 2014/2024 split
packages/vetools-index  the browsing index shipped with the app
packages/contracts      CharacterBuild
packages/domain         5e rules and derivations
packages/foundry-exporter  legacy, fabricates items, being replaced
packages/data-engine       legacy catalog, superseded by vetools-index
scripts/ templates/ styles/   the legacy root Foundry module
```

The legacy module is still the only working import path.

## Verifying

```
corepack pnpm mvp:verify
```

Builds the shared packages, runs every suite, and regenerates the Foundry
fixtures. It passes from a clean checkout.

Individual entrypoints: `verify:env`, `packages:build`, `web:verify`,
`foundry:verify`, `release:ready`.

## Regenerating data

Both generated artifacts come from a Plutonium install:

```
node scripts/extract-vetools-sources.mjs <plutonium>/js/Bundle.js <out.mjs>
corepack pnpm vetools:index <plutonium>/data
```

## Requirements

Plutonium 2.17.2 requires Foundry v14, dnd5e 5.3.x and lib-wrapper. This repo
does not target those versions yet.
