# Foundry Module

**This is the import path.** It has created real actors in a live world since
2026-08-24, on Foundry v14.367 with dnd5e 5.3.3.

The legacy prototype still sits at the repository root — [module.json](../../module.json),
[scripts/vault-app.js](../../scripts/vault-app.js),
[scripts/character-builder.js](../../scripts/character-builder.js) — and
declares the same module id. It builds actors by fabricating item documents,
which is why its imported spells and equipment never functioned. Nothing
depends on it; removing it is open work.

**Installing it is part of merging a pull request that changes it.** A copy in
a Foundry data directory keeps its version number while its code falls behind:
one was four pull requests behind while still calling itself `0.2.2`. Compare
by hash, never by version —
`git hash-object <install>/src/import.js` against
`git rev-parse HEAD:apps/foundry-module/src/import.js`.

## What this module does

1. Take a short code from the player.
2. Fetch the build it identifies.
3. Resolve each `{page, source, hash}` reference through Plutonium.
4. Create the actor, batching the imports onto it.

It never constructs an item. Plutonium returns the real document, with its
activities, damage and icons intact.

See [docs/PLUTONIUM-INTEGRATION.md](../../docs/PLUTONIUM-INTEGRATION.md) for the
API surface, and [scripts/uuid-resolver.js](../../scripts/uuid-resolver.js) for
the prototype of reference resolution that already exists in the legacy module.

## Requirements

Plutonium 2.17.2 requires Foundry v14, dnd5e 5.3.x and lib-wrapper. This
module's `module.json` declares exactly that — Foundry 14 verified, dnd5e 5.3.0
minimum and 5.3.3 verified, Plutonium required. The root `module.json` still
declares Foundry 12-13; it is the legacy one.
