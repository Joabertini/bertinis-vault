# Deploy

Three pieces: the worker that stores builds, the web builder, and the Foundry
module. Only the worker needs an account you have to log into.

## Worker

Two commands need your Cloudflare account and cannot be run for you: `wrangler
login` opens a browser, and creating a KV namespace writes to your account.

```bash
cd apps/worker

npx wrangler login
npx wrangler kv namespace create BUILDS
```

The second prints an id. Put it in `wrangler.toml`, replacing `REPLACE_ME`:

```toml
[[kv_namespaces]]
binding = "BUILDS"
id = "<the id it printed>"
```

Then deploy:

```bash
corepack pnpm worker:deploy
```

Check it answers:

```bash
curl https://bertinis-vault.bertinisdnd.workers.dev/health
# {"ok":true}
```

Once the web builder has a public address, narrow the origin list in
`wrangler.toml` from `*` to it. Leaving it open lets any page post builds to
your store.

### Running it locally

`npx wrangler dev` serves on `127.0.0.1:8787`, which is what the web builder
defaults to, so `pnpm worker:dev` and `pnpm web:dev` work together with no
configuration.

## Web builder

A static build. `corepack pnpm web:build` writes `apps/web/dist`.

It needs one variable, the worker's address:

```
VITE_VAULT_URL=https://bertinis-vault.bertinisdnd.workers.dev
```

Without it the builder still works — the index is bundled, so browsing and
building need no server — but generating a code will fail, because that is the
one thing that talks to the worker.

## Foundry module

The module lives in `apps/foundry-module` and installs from its manifest:

```
https://raw.githubusercontent.com/Joabertini/bertinis-vault/main/apps/foundry-module/module.json
```

It requires Foundry v14, dnd5e 5.3.x, and Plutonium. Plutonium is what turns a
reference into a real document; without it there is nothing to import.

If you deploy the worker somewhere other than the default, set **Vault address**
in the module settings to match.

### Releasing it

Pushing a `v*` tag runs `.github/workflows/release.yml`, which runs the gate,
checks `pnpm release:ready`, builds the zip and publishes the release.

Two things have to be true before the tag, and both have caught releases out:

1. **Bump the version in the committed `module.json`.** The workflow writes the
   tag's version into its own copy before zipping, but Foundry's update check
   reads the manifest URL above, which serves `main`'s copy. A release whose
   committed manifest still says the old version is a release nobody is offered.
   Bump `apps/foundry-module/package.json` alongside it.
2. **Sign [`FOUNDRY-MANUAL-VALIDATION-REPORT.md`](./FOUNDRY-MANUAL-VALIDATION-REPORT.md).**
   `release:ready` refuses while anything in it is `pending`. The automated gate
   proves the pipeline is internally consistent; only a live run proves it
   produces a character, and every fault this module has had was one the gate
   could not see.

If a release has to go out before the report is signed — as v0.2.2 did, the day
the import first came out clean — build and publish it by hand, and say in the
notes that it was:

```bash
cd apps/foundry-module
zip -r bertinis-vault.zip module.json src lang styles
gh release create v0.2.2 bertinis-vault.zip
```

That is a deliberate bypass of a gate, not a shortcut around a broken one. Reach
for it knowingly.

## What is verified, and what is not

The worker, the payload contract, the reference resolution and the module's
import logic all have tests — 245 of them, run by `corepack pnpm mvp:verify`,
plus 80 in the web builder.

Set `PLUTONIUM_DIR` when running the gate. Without it,
`apps/foundry-module/test/plutonium-bundle.test.mjs` skips, and that suite is
the one that checks this module's assumptions about Plutonium against
Plutonium's own bundle rather than against a fixture. Three wrong fixes shipped
green because no such test existed.

The module has now run in a live world and imported a character with no prompts.
What that run did not cover is scenarios 1 through 4 of
[`FOUNDRY-MANUAL-VALIDATION-REPORT.md`](./FOUNDRY-MANUAL-VALIDATION-REPORT.md),
and the remaining open questions are at the end of
[PLUTONIUM-INTEGRATION.md](./PLUTONIUM-INTEGRATION.md). Both need a live world
with Foundry v14, dnd5e 5.3.x and Plutonium active.
