/**
 * Los cuatro escenarios del reporte de validación de Foundry, como payloads.
 *
 * Deriva cada personaje con el mismo código que la web y escribe los payloads
 * en un json, sin publicar nada. Se importan después con `importPayload` del
 * módulo. El guerrero lleva una portada, para ver también el retrato.
 */
import { writeFileSync } from "node:fs";

import { VEINTICUATRO } from "./fixtures/veinticuatro";
import { resolveDraft } from "@/lib/derive";

const PORTADA = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const ESCENARIOS: Array<[string, string, string]> = [
  ["1-guerrero", "Dorn Yelmo Roto", PORTADA],
  ["2-clerigo", "Sor Amadea de la Vela", ""],
  ["3-brujo", "Cassia Pacto de Cuervos", ""],
  ["4-especie-trasfondo", "Mira Vela de Sangre", ""],
];

const salida: Record<string, unknown> = {};

for (const [clave, nombre, coverImage] of ESCENARIOS) {
  const state = VEINTICUATRO.find((s) => s.characterName === nombre);
  if (!state) throw new Error(`No está ${nombre}`);
  const resolved = resolveDraft({ ...state, coverImage });
  console.log(`${clave}: ${resolved.status}, fallas ${resolved.failures?.length ?? 0}`);
  for (const f of resolved.failures ?? []) console.log(`  ! ${JSON.stringify(f)}`);
  salida[clave] = resolved.payload;
}

writeFileSync(process.argv[2] ?? "escenarios.json", JSON.stringify(salida));
