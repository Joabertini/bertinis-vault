# AI Handoff

Fast start for the next agent working on this repo.

## Read first

1. [`ARCHITECTURE-PLAN.md`](../ARCHITECTURE-PLAN.md) — what the product is and
   how it is built.
2. [`PLUTONIUM-INTEGRATION.md`](./PLUTONIUM-INTEGRATION.md) — the import path,
   read from Plutonium's own bundle.
3. [`DEPLOY.md`](./DEPLOY.md) — the three pieces and what shipping them needs.

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

Working and verified, except the last two arrows, which have never run.

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

1. **Deploy the worker.** Needs a Cloudflare account: `wrangler login` and
   creating the KV namespace. See `DEPLOY.md`.
2. **Run the module in a live world.** Needs Foundry v14, dnd5e 5.3.x and
   Plutonium. This is the only way to close the open questions at the end of
   `PLUTONIUM-INTEGRATION.md`, all of which were answered by reading source
   rather than by observation.
3. **Move `domain` off `data-engine`.** It imports it only for
   `get*CatalogEntry` lookups, which `vetools-index` supersedes. This touches 24
   passing tests, so it is the highest-risk change left.
4. **Delete `data-engine` and the item fabrication in `foundry-exporter`.** Only
   after 3.
5. **Retire `apps/api`.** The index is bundled; nothing fetches datasets.

The wizard interface is its own track. The design is ours, not a reproduction of
Charactermancer — Plutonium's rules coverage, our interface.

## Verifying

```
corepack pnpm mvp:verify
```

164 tests across seven suites, plus the Foundry fixtures. It must pass from a
clean checkout — verify that by deleting every `dist` first, because two
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
