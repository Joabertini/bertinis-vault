# AI Handoff

Fast start for the next agent working on this repo.

## Read first

1. [`ARCHITECTURE-PLAN.md`](../ARCHITECTURE-PLAN.md) — what the product is and
   how it is built.
2. [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md) — the import path,
   read from Plutonium's own bundle.

Those two are current. Treat anything else in this directory as a record of how
the project got here, not as instructions.

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

## Where things are

| Path | What |
| --- | --- |
| `packages/vetools-ref` | Reference triples, source registry, 2014/2024 split |
| `packages/vetools-index` | The browsing index, generated and committed |
| `packages/contracts` | `CharacterBuild` |
| `packages/domain` | 5e rules and derivations |
| `packages/foundry-exporter` | Legacy. Fabricates items. Being replaced. |
| `packages/data-engine` | Legacy hand-written catalog. Superseded by `vetools-index`. |
| `scripts/`, `templates/`, `styles/` | The legacy root Foundry module |

The legacy module is still the only working import path. Do not delete it before
its replacement works.

## Verifying

```
corepack pnpm mvp:verify
```

Runs environment checks, builds the shared packages, then the web, API, domain,
reference and index suites, then regenerates and verifies the Foundry fixtures.

It must pass from a clean checkout. If it does not, that is a bug in the gate,
not something to work around.

Two things worth knowing:

- The generated fixtures under `docs/foundry-validation-fixtures/` are not
  deterministic. Each run produces fresh document ids and a timestamp, so the
  working tree goes dirty after every gate run. The diff is noise unless the
  shape changed.
- Regenerating the index needs a 5etools data directory:
  `corepack pnpm vetools:index <path-to-5etools-data>`. The generator refuses to
  emit a row with no resolvable source.

## Regenerating from Plutonium

Both generated artifacts come from a Plutonium install:

```
node scripts/extract-vetools-sources.mjs <plutonium>/js/Bundle.js <out.mjs>
node scripts/build-vetools-index.mjs <plutonium>/data
```

Plutonium's bundle ships unminified, so it can be read directly. That is how the
API surface, the hash algorithm and the source registry were established — not
from documentation, which does not cover them.

## Open questions

Everything known about Plutonium's runtime behaviour was read from source, never
observed running. The list of what still needs confirming in a live world is at
the end of [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md).

Confirming it needs Foundry v14, dnd5e 5.3.x and Plutonium active. The repo does
not target those versions yet.
