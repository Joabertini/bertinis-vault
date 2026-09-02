# Contributing to Bertini's Vault

> Rewritten 2026-09-02. The previous version described `scripts/vault-app.js`,
> dnd5e 5.2.5 and Foundry 13.351 — the legacy root module, which stopped being
> the import path in August. It is in git history if you need it.

## Layout

```
apps/web              the builder: Gate, Forge, Codex, Ritual
apps/worker           the store: saves a build, returns it by code, keeps accounts
apps/foundry-module   resolves a build's references into a real actor
packages/contracts      CharacterBuild, ImportPayload — the shapes everything agrees on
packages/domain         5e rules: derivations, spell progression, proficiencies
packages/vetools-ref    the {page, source, hash} triple, sources, 2014/2024 split
packages/vetools-index  the browsing index shipped with the app
```

Legacy, being retired, do not build on: `apps/api`, `packages/data-engine`,
`packages/foundry-exporter`, and the root module (`module.json`, `scripts/`,
`templates/`, `styles/`).

## Getting started

```
corepack enable
corepack pnpm install
corepack pnpm verify:env      # Node, pnpm and workspace prerequisites
corepack pnpm web:dev         # the builder, Vite, usually http://127.0.0.1:5173
```

The builder is entirely client-side: the browsing index ships in the bundle, so
nothing needs a server running to build a character. `apps/worker` is only
needed to save a build and hand back a code — `corepack pnpm worker:dev` runs
it locally on `127.0.0.1:8787`, and `apps/web/.env.example` shows how to point
the builder at it.

Deploying any of the three pieces: [docs/DEPLOY.md](./docs/DEPLOY.md).

## The gate

```
corepack pnpm mvp:verify
```

Builds the shared packages, runs every suite, and regenerates
`docs/MVP-RELEASE-STATUS.md`. It passes from a clean checkout. Do not edit that
file by hand — it is generated.

On a slow disk, vitest is configured for threads rather than forks and two
workers rather than one per core. A gate that goes red for the machine teaches
everyone to ignore it, which is exactly what you do not want the day it goes
red for real.

## Rules this project learned the hard way

Each of these cost a week or more. They are not style preferences.

**1. Reference entities, never fabricate them.** A hand-built item looks right
on the sheet and does nothing when clicked. Plutonium turns a
`{page, source, hash}` into a real `dnd5e` document with working activities,
damage and icons. If you are writing item fields by hand, stop.

**2. Change `ImportPayload`, deploy the Worker.**
`importPayloadSchema.safeParse` strips what it does not know and answers 200,
so an older deployment discards new fields in silence and every layer reports
success. Run the guard after any payload change and after any deploy:

```
cd apps/web
corepack pnpm exec vite build --ssr probes/store-fidelity.ts --outDir .probe
node .probe/store-fidelity.js
```

**3. Compare the installed Foundry module by hash, never by version.** A copy
installed in a Foundry data directory keeps its version number while its code
falls behind. One was four pull requests behind while still calling itself
`0.2.2`:

```
git hash-object "<FoundryData>/modules/bertinis-vault/src/import.js"
git rev-parse HEAD:apps/foundry-module/src/import.js
```

Installing the module is part of merging a pull request that changes it.

**4. No hand-written game tables.** Every fix in the build order replaced a
table someone typed with the structured field 5etools already carries —
`multiclassing.proficienciesGained`, `startingEquipment.defaultData`,
`background.ability`, `classTableGroups`, `additionalSpells`,
`feat.prerequisite`, `optionalFeatureProgression`. If you are about to type a
list of class features, the data already has it under a name you have not found
yet.

**5. A wrong answer is worse than a gap.** The sheet does not tell the player
when a number is wrong. Show a dash, not a confident placeholder.

**6. Keep `packages/` free of browser APIs.** See
[docs/PORTABILIDAD.md](./docs/PORTABILIDAD.md). The desktop track depends on
this and cannot enforce it from its own repository.

## Documentation

Documentation rot is what this project's worst planning mistakes were made of:
work was planned against documents that described a state the code had left
months earlier. Two rules.

**A pull request that changes what a document asserts updates that document in
the same pull request.** Not afterwards, not in a docs pass.

**A document either asserts or narrates, never both.** A document that asserts
the current state is maintained. A document that narrates how something was
done carries a closing date in its header and is never edited again — it is a
record. `docs/AUDITORIA-CREACION.md` asserts; `docs/MIGRACION-FRONT.md`
narrates and says so in its first lines.

If you are unsure which kind you are writing, you are writing a record.

## Commits and pull requests

- One concern per pull request, and a body that says what was measured. The
  measurement is the deliverable; the fix is what follows from it.
- Merge commits, not squash: squashing breaks the ancestry checks used against
  the deployed history.
- Nothing about business, pricing or strategy belongs in this repository.
