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
curl https://bertinis-vault.<your-subdomain>.workers.dev/health
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
VITE_VAULT_URL=https://bertinis-vault.<your-subdomain>.workers.dev
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

`module.json` points its download at a GitHub release asset. To cut one, zip the
module directory and attach it:

```bash
cd apps/foundry-module
zip -r bertinis-vault.zip module.json src lang styles
gh release create v0.2.0 bertinis-vault.zip
```

## What is verified, and what is not

The worker, the payload contract, the reference resolution and the module's
import logic all have tests: 164 across seven suites, run by `corepack pnpm
mvp:verify`.

What has never run is the module inside Foundry. Everything it does with
Plutonium was read from Plutonium's own bundle, not observed. The open questions
are at the end of [PLUTONIUM-INTEGRATION.md](./PLUTONIUM-INTEGRATION.md), and
answering them needs a live world with Foundry v14, dnd5e 5.3.x and Plutonium
active.
