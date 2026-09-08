/**
 * Resolver los veinticuatro y, si se pide, publicarlos.
 *
 * Sin argumentos sólo mide: deriva cada personaje e imprime lo que no resolvió.
 * Eso es lo que sirve como detector de regresiones — un id que se rompe cuando
 * cambia el índice aparece acá y no en una mesa.
 *
 * Con `--publicar` los manda al almacén y escribe los códigos. Eso escribe de
 * verdad, así que es una bandera y no el comportamiento por defecto.
 *
 * Desde `apps/web`:
 *
 *   corepack pnpm exec vite build --ssr probes/veinticuatro.ts --outDir .probe
 *   node .probe/veinticuatro.js
 *   VITE_VAULT_URL=https://api.bertinilabs.xyz node .probe/veinticuatro.js --publicar
 */
import { VEINTICUATRO } from "./fixtures/veinticuatro";
import { characterLevelFor } from "@/lib/builder";
import { resolveDraft } from "@/lib/derive";
import { publishBuild, vaultBaseUrl } from "@/lib/vault-client";

const PUBLICAR = process.argv.includes("--publicar");

async function main(): Promise<void> {
  console.log(`Almacen: ${vaultBaseUrl()}`);
  console.log(`Personajes: ${VEINTICUATRO.length}${PUBLICAR ? " — PUBLICANDO" : " — solo midiendo"}\n`);

  let sinResolver = 0;
  const codigos: string[] = [];

  for (const state of VEINTICUATRO) {
    const resolved = resolveDraft(state);
    const etiqueta = `${state.characterName} — ${state.classId} ${characterLevelFor(state)}`;

    if (resolved.status !== "ready") {
      console.log(`${etiqueta}\n  NO DERIVA: falta ${resolved.missing.join(", ")}`);
      sinResolver += 1;
      continue;
    }

    const { payload, snapshot, failures } = resolved;

    console.log(etiqueta);
    console.log(
      `  PG ${snapshot.derived?.hp ?? "?"}   CA ${snapshot.derived?.ac ?? "?"}   comp +${snapshot.derived?.proficiencyBonus ?? "?"}`,
    );
    console.log(`  hechizos ${payload?.spells?.length ?? 0}   objetos ${payload?.equipment?.length ?? 0}`);

    if (failures.length > 0) {
      sinResolver += failures.length;
      console.log(`  SIN RESOLVER (${failures.length}):`);
      for (const failure of failures) console.log(`    ! ${JSON.stringify(failure)}`);
    }

    if (!payload) {
      console.log("  sin payload, no se publica");
      continue;
    }

    if (!PUBLICAR) continue;

    try {
      const published = await publishBuild(payload, state);
      console.log(`  CODIGO ${published.code}`);
      codigos.push(`${published.code}\t${state.characterName}\t${state.classId} ${characterLevelFor(state)}`);
    } catch (error) {
      console.log(`  fallo al publicar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nReferencias sin resolver: ${sinResolver}`);

  if (codigos.length > 0) {
    console.log(`\n--- codigos (${codigos.length}) ---`);
    for (const linea of codigos) console.log(linea);
  }
}

void main();
