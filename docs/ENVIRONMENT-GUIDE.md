# Environment Guide

> **Historical record. Closed 2026-09-02. Superseded, do not follow.**
>
> Written when `apps/api` served the builder's content and the root module was
> the export path. Both are gone: no server serves content any more, and
> `apps/foundry-module` — described below as "planned" — has been the import
> path since August. It also refers to `apps/web/src/App.tsx`, which stopped
> existing when the front was replaced.
>
> What replaced it:
> - **Setup and daily work** → [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
> - **Deploying the three pieces** → [`DEPLOY.md`](./DEPLOY.md)
> - **Accounts, secrets and DNS** → [`CUENTAS.md`](./CUENTAS.md)
>
> Kept for the `apps/api` variable reference, which is still accurate for that
> legacy service.

## Purpose

This guide describes the real local development environment for the current `bertinis-vault` monorepo as it exists today.

Use it when you need to:

- install the workspace on a new machine;
- run the web builder and API together;
- understand which variables are actually used;
- know which pieces are stable versus still transitional.

## Repository Shape

The repository is a `pnpm` workspace with these active areas:

- `apps/web`: React 19 + Vite 6 builder UI.
- `apps/api`: Node.js + TypeScript HTTP API and upstream dataset bridge.
- `apps/foundry-module`: planned Foundry-focused app surface.
- `packages/contracts`: shared contracts and schemas.
- `packages/data-engine`: local catalogs and normalization helpers.
- `packages/domain`: business rules and derived character logic.
- `packages/foundry-exporter`: canonical-to-Foundry payload generation.
- repository root: current Foundry module prototype and monorepo entry scripts.

## Required Tools

Recommended baseline:

- Node.js 22 LTS or newer.
- `corepack` enabled.
- `pnpm` `10.6.2` via the repo `packageManager` field.

Optional but strongly recommended:

- Foundry VTT 12 or 13 for manual validation.
- Git for commits and pushes.
- GitHub CLI (`gh`) for PR workflows.

## First-Time Setup

From the repository root:

```bash
corepack enable
corepack pnpm install
```

That installs the workspace dependencies used by:

- root scripts;
- `apps/web`;
- `apps/api`;
- all shared packages under `packages/*`.

## Local Services

### Web Builder

Run from the repository root:

```bash
corepack pnpm web:dev
```

What it does:

- starts the Vite dev server from `apps/web`;
- uses the local API by default at `http://127.0.0.1:3001`;
- falls back to curated local datasets if API fetches fail.

Default Vite address:

- usually `http://127.0.0.1:5173` or `http://localhost:5173`.

### API

Run from the repository root:

```bash
corepack pnpm api:dev
```

What it does:

- builds `@bertinis-vault/data-engine` first;
- builds `apps/api`;
- runs `node --watch dist/index.js`;
- listens on `127.0.0.1` only.

Default API address:

- `http://127.0.0.1:3001`

Health check:

```text
GET /health
```

Useful dataset endpoints:

```text
GET /datasets/meta
GET /datasets/builder-options
GET /datasets/classes
GET /datasets/races
GET /datasets/backgrounds
GET /datasets/feats
GET /datasets/equipment
GET /datasets/spells
```

Additional semantic routes also exist, including:

```text
GET /classes
GET /classes/:id
GET /classes/:id/subclasses
GET /classes/:id/spells
GET /spells
GET /spells/:id
GET /items
GET /items/:id
GET /upstream/status
GET /upstream/json?path=...
```

## Environment Variables

These are the variables currently used by the codebase.

### API Variables

`PORT`

- Default: `3001`
- Used by `apps/api/src/index.ts`
- Controls the local API listen port

`BERTINIS_5E_API_URL`

- Default: `https://bertinis-5e-api.onrender.com`
- Used by `apps/api/src/five-tools-client.ts`
- Controls the upstream base URL the API uses when proxying or building hybrid datasets

`BERTINIS_5E_UPSTREAM_CLASSES_PATH`
`BERTINIS_5E_UPSTREAM_RACES_PATH`
`BERTINIS_5E_UPSTREAM_BACKGROUNDS_PATH`
`BERTINIS_5E_UPSTREAM_FEATS_PATH`
`BERTINIS_5E_UPSTREAM_EQUIPMENT_PATH`
`BERTINIS_5E_UPSTREAM_SPELLS_PATH`

- Used by the dataset/upstream pipeline in `apps/api`
- Allow per-dataset upstream path overrides
- Useful when testing alternate 5etools-compatible payloads

### Web Variables

`VITE_BERTINIS_API_URL`

- Default: `http://127.0.0.1:3001`
- Used by `apps/web/src/builder-options.ts`
- Points the web builder at a local or remote API

## Practical `.env` Usage

There is no committed `.env.example` yet, but these are the practical values for local work.

### `apps/api/.env`

```dotenv
PORT=3001
BERTINIS_5E_API_URL=https://bertinis-5e-api.onrender.com
```

### `apps/web/.env.local`

```dotenv
VITE_BERTINIS_API_URL=http://127.0.0.1:3001
```

If you want the frontend to use the hosted API instead of the local one:

```dotenv
VITE_BERTINIS_API_URL=https://bertinis-5e-api.onrender.com
```

## Daily Workflow

Recommended local workflow:

1. Run `corepack pnpm verify:env`.
2. Start both services with `corepack pnpm dev`.
3. If you only need one side, use `corepack pnpm api:dev` or `corepack pnpm web:dev`.
4. Open the builder in the browser.
5. Confirm `/health` responds from the API.
6. Build or typecheck before finishing the session.

## Validation Commands

From the repository root:

```bash
corepack pnpm verify:env
corepack pnpm dev
corepack pnpm web:typecheck
corepack pnpm web:build
corepack pnpm web:verify
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
```

Focused package checks:

```bash
corepack pnpm --filter @bertinis-vault/api test
corepack pnpm --filter @bertinis-vault/contracts test
corepack pnpm --filter @bertinis-vault/domain test
corepack pnpm --filter @bertinis-vault/data-engine test
corepack pnpm --filter @bertinis-vault/foundry-exporter test
```

## Current Environment Reality

Important operational details for this repo right now:

- the web builder is the active product surface for day-to-day development;
- the web UI still contains some temporary embedded maps and fallback rules in `apps/web/src/App.tsx`;
- the API supports local, upstream, and hybrid dataset modes;
- the upstream/cache layer is in-memory, not persistent;
- the root Foundry module prototype is still active for real export validation;
- some files still contain encoding issues, so UTF-8 cleanup remains part of project hardening.

## What Is Missing From The Environment Story

These are still not fully productized:

- a committed `.env.example` at root or per app;
- persistent storage for drafts and characters;
- Docker or container setup;
- CI-enforced environment smoke tests;
- a one-command script to boot both API and web together;
- a documented Foundry validation sandbox setup.

## Recommended Next Environment Improvements

1. Add `apps/api/.env.example` and `apps/web/.env.example`.
2. Add a root `dev` script that runs API and web together.
3. Add a root `doctor` or `verify:env` script for Node, pnpm, ports, and Foundry prerequisites.
4. Document the exact Foundry module install path and validation world setup.
5. Add UTF-8 normalization to the docs and frontend text pipeline.
