/**
 * Does the deployed store give back every field the builder sent it?
 *
 * `importPayloadSchema.safeParse` strips what it does not know and answers
 * 200, so a Worker older than the contract discards new fields in silence.
 * On 2026-09-01 the deployed Worker was from 23 August and threw away 20 of
 * 73 fields: every appearance field, weapon and armour proficiencies, weapon
 * masteries, tool expertise, starting currency, and `optionalFeatures` — the
 * one that carries fighting styles, invocations, the pact boon, metamagic and
 * maneuvers. A warlock reached the table with no invocations and nothing said
 * so.
 *
 * Nothing else catches this. The unit tests check the builder against the
 * contract in the repository, which is always current; only a round trip
 * through the deployed store can show that the deployment is not.
 *
 * Run from `apps/web`, after any change to `ImportPayload` and after any
 * Worker deploy:
 *
 *   corepack pnpm exec vite build --ssr probes/store-fidelity.ts --outDir .probe
 *   node .probe/store-fidelity.js
 *
 * Exit code 1 means the store is behind the builder. Deploy the Worker.
 */
import type { ImportPayload } from "@bertinis-vault/contracts";

import { initialState } from "@/lib/builder";
import { resolveDraft } from "@/lib/derive";
import { vaultBaseUrl } from "@/lib/vault-client";

/** Every path in an object, so a dropped leaf is named and not just counted. */
function paths(value: unknown, prefix = "", out: string[] = []): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    paths(child, path, out);
  }
  return out;
}

async function main(): Promise<void> {
  const base = vaultBaseUrl().replace(/\/+$/, "");
  const resolved = resolveDraft(initialState);

  if (resolved.status !== "ready" || !resolved.payload) {
    console.error("The demo draft does not resolve; fix that before reading this result.");
    process.exit(1);
  }

  const sent: ImportPayload = resolved.payload;

  const created = await fetch(`${base}/builds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sent),
  });

  if (!created.ok) {
    console.error(`POST /builds answered ${created.status}`);
    process.exit(1);
  }

  const { code } = (await created.json()) as { code: string };
  const stored = await fetch(`${base}/builds/${code}`);
  const { payload: back } = (await stored.json()) as { payload: unknown };

  const kept = new Set(paths(back));
  const lost = paths(sent).filter(path => !kept.has(path));

  console.log(`store   ${base}`);
  console.log(`code    ${code}`);
  console.log(`fields  ${paths(sent).length} sent, ${kept.size} returned`);

  if (!lost.length) {
    console.log("\nThe store returns everything the builder emits.");
    return;
  }

  console.log(`\n${lost.length} DISCARDED — the deployed Worker is older than the contract:`);
  for (const path of lost) console.log(`  - ${path}`);
  console.log("\nFix: deploy the Worker. Nothing on the front or in the module will help.");
  process.exit(1);
}

void main();
