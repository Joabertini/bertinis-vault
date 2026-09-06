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

Two things about that line, both of which broke it and neither of which said
so. `pnpm --filter <pkg> deploy` runs **pnpm's own** `deploy` command, not the
package's script, and answers `ERR_PNPM_INVALID_DEPLOY_TARGET`; it needs `run
deploy`. And `wrangler` is not a dependency of anything here, so the script
calls it through `npx` the way the two commands above do.

Check it answers:

```bash
curl https://bertinis-vault.bertinisdnd.workers.dev/health
# {"ok":true}
```

Once the web builder has a public address, narrow the origin list in
`wrangler.toml` from `*` to it. Leaving it open lets any page post builds to
your store.

**The Worker goes out before the web, whenever what a publish sends changes.**
The two deploy separately — Vercel on merge, this by hand — so the order is a
real choice and only one of them is safe. A new Worker still accepts what an
old page sends; an old Worker validates the whole body as the payload, so a new
page's envelope fails its schema and every publish answers 422. Sharing breaks
for everyone until the Worker catches up, and nothing in the merge says so.

### Running it locally

`npx wrangler dev` serves on `127.0.0.1:8787`, which is what the web builder
defaults to, so `pnpm worker:dev` and `pnpm web:dev` work together with no
configuration.

## Web builder

A static build. `corepack pnpm web:build` writes `apps/web/dist`.

It needs one variable, the worker's address, and it lives in
`apps/web/.env.production` rather than in the host's dashboard, because it is
baked into the bundle at build time and is public by design:

```
VITE_VAULT_URL=https://api.bertinilabs.xyz
```

Without it the builder still works — the index is bundled, so browsing and
building need no server — but generating a code will fail, because that is the
one thing that talks to the worker.

Its own name under the site's domain, not `workers.dev`: a session cookie only
travels between addresses that share a registrable domain, so a page talking to
`workers.dev` can store builds and can never hold an account.

**Every path has to serve `index.html`.** The router is a `BrowserRouter` with
five paths — `/`, `/forge`, `/codex`, `/ritual`, `/tomo/:code` — and none of them
is a file in `dist`, so a static host answers 404 to anyone who types one,
reloads on one, or is sent back to one. Neither case is hypothetical: a sign-in
returns to `/codex`, so accounts cannot work at all without this, and
`/tomo/:code` is a link people paste to each other, so it is *always* typed
cold. On Vercel it is the rewrite in `vercel.json`:

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

It cannot swallow the assets: the filesystem is matched before rewrites are,
so `/assets/*`, `/fonts/*` and `/foundry/*` are served as themselves.

## Foundry module

The module lives in `apps/foundry-module` and installs from its manifest:

```
https://alba.bertinilabs.xyz/foundry/module.json
```

**It is served by the site, not by GitHub.** The repo went private on
2026-09-06, and a private repo answers 404 to anyone without a token — both on
`raw.githubusercontent.com` and on release assets, which is every Foundry
install and every update check. `pnpm foundry:package` runs as the last step of
the Vercel build and writes `module.json` plus `bertinis-vault.zip` into
`dist/foundry/`, so the manifest Foundry polls is always the one main deploys.
The script refuses to build if the committed manifest points anywhere else.

It requires Foundry v14, dnd5e 5.3.x, and Plutonium. Plutonium is what turns a
reference into a real document; without it there is nothing to import.

If you deploy the worker somewhere other than the default, set **Vault address**
in the module settings to match.

### Releasing it

Pushing a `v*` tag runs `.github/workflows/release.yml`, which runs the gate,
checks `pnpm release:ready`, builds the zip and publishes the release. The
release is an archive of what shipped: players install from the site, and a
private repo's assets are unreachable to them anyway.

Two things have to be true before the tag, and both have caught releases out:

1. **Bump the version in the committed `module.json`.** Foundry's update check
   reads the manifest the site serves, which is main's copy, so a release whose
   committed manifest still says the old version is a release nobody is offered.
   The workflow now fails on that mismatch instead of papering over it by
   rewriting its own copy. Bump `apps/foundry-module/package.json` alongside it.
2. **Sign [`FOUNDRY-MANUAL-VALIDATION-REPORT.md`](./FOUNDRY-MANUAL-VALIDATION-REPORT.md).**
   `release:ready` refuses while anything in it is `pending`. The automated gate
   proves the pipeline is internally consistent; only a live run proves it
   produces a character, and every fault this module has had was one the gate
   could not see.

If a release has to go out before the report is signed — as v0.2.2 did, the day
the import first came out clean — build and publish it by hand, and say in the
notes that it was:

```bash
corepack pnpm foundry:package ./release
gh release create v0.2.2 ./release/bertinis-vault.zip
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
