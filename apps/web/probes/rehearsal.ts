/**
 * Publish a real character and print the code, so the live Foundry pass is
 * one step: open the world, run the import, type the code.
 *
 * This exercises the path the beta actually uses — builder state, derivation,
 * `ImportPayload`, `POST /builds` — and not the fabricated-actor fixtures in
 * `docs/foundry-validation-fixtures/`, which the module cannot consume and
 * which still target Foundry 13 and dnd5e 5.2.5.
 *
 * Run from `apps/web`:
 *
 *   corepack pnpm exec vite build --ssr probes/rehearsal.ts --outDir .probe
 *   node .probe/rehearsal.js
 */
import { initialState, type BuilderState } from "@/lib/builder";
import { resolveDraft } from "@/lib/derive";
import { publishBuild, vaultBaseUrl } from "@/lib/vault-client";

async function publish(label: string, state: BuilderState): Promise<void> {
  const resolved = resolveDraft(state);

  if (resolved.status !== "ready") {
    console.log(`\n${label}: draft is not ready to forge (${resolved.status}). Skipped.`);
    return;
  }

  const { payload, failures } = resolved;

  if (!payload) {
    console.log(`\n${label}: no payload. Failures:`);
    for (const failure of failures ?? []) console.log(`  - ${JSON.stringify(failure)}`);
    return;
  }

  const bytes = Buffer.byteLength(JSON.stringify(payload));

  // The name lives on `identity`, not at the root. Reading `payload.name`
  // returns undefined and prints a character with no name, which reads as a
  // product bug and is not one.
  console.log(`\n${label}`);
  console.log(`  name        ${payload.identity?.characterName ?? "(unnamed)"}`);
  console.log(`  rules       ${payload.rulesVersion ?? "?"}`);
  console.log(
    `  classes     ${payload.classes.map(entry => `${entry.ref.hash} ${entry.level}`).join(" / ")}`,
  );
  console.log(`  species     ${payload.race?.ref.hash ?? "-"}`);
  console.log(`  spells      ${payload.spells?.length ?? 0}`);
  console.log(`  equipment   ${payload.equipment?.length ?? 0}`);
  console.log(`  size        ${bytes} bytes`);
  console.log(`  unresolved  ${failures?.length ?? 0}`);

  for (const failure of failures ?? []) console.log(`    ! ${JSON.stringify(failure)}`);

  try {
    const published = await publishBuild(payload);
    console.log(`  CODE        ${published.code}`);
    if (published.expiresAt) console.log(`  expires     ${published.expiresAt}`);
  } catch (error) {
    console.log(`  publish failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  console.log(`Vault: ${vaultBaseUrl()}`);

  await publish("Demo character (the builder's own initial state)", initialState);
}

// Not top-level await: the build targets browsers, which do not allow it here.
void main();
