/**
 * Las clases de armadura alternativas que un personaje trae puestas.
 *
 * La Defensa sin Armadura del bárbaro y del monje, las escamas del hechicero
 * dracónico, el caparazón del tortle. `character-build.ts` las pide desde el
 * 2026-08-26 y `builder.ts` mandaba una lista vacía con un comentario que decía
 * la verdad: *"es cableado que falta, no datos que falten"*.
 *
 * Los datos estaban. El índice trae `armorClass` en la fila de la clase, en la
 * de la subclase y en la del linaje, y `bestArmorClass` sabe qué hacer con
 * ellas desde el principio. Lo único que faltaba era leerlas.
 *
 * Sin esto, un monje de nivel 5 con 18 de Destreza y 15 de Sabiduría mostraba
 * CA 14 en vez de 16 — el 10 + Destreza de estar desnudo, sin la Sabiduría que
 * su propia clase le suma. Un bárbaro perdía la Constitución igual. Y no había
 * nada en la ficha que dijera que faltaba un número.
 *
 * ## Qué se filtra acá y qué no
 *
 * **Por nivel, sí.** Una opción de nivel 3 no es de un personaje de nivel 2, y
 * el nivel que corresponde no es el mismo en los dos casos: la Defensa sin
 * Armadura la da la clase, así que se mide contra los niveles *de esa clase* —
 * un guerrero 8 / monje 1 tiene la del monje de nivel 1, no la de nivel 8. La
 * del linaje se mide contra el nivel del personaje.
 *
 * **Por variante, no.** `bestArmorClass` ya recibe las características tomadas
 * y descarta las `isVariant` que el personaje no eligió. Filtrar acá también
 * sería el mismo juicio hecho en dos lugares, y el segundo lugar es siempre el
 * que se olvida de actualizar.
 */

import { classInfoFor, raceInfoFor, subclassInfoFor } from "./index-options";
import type { ArmorClassOption } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

/** Una clase con su subclase y su nivel, como la lleva el borrador. */
type Classing = { classId: string; subclassId: string; level: number };

/**
 * Las opciones que alcanza este personaje, sin repetidas.
 *
 * Se deduplica por nombre y libro porque un multiclase bárbaro/monje llega con
 * dos Defensas sin Armadura distintas —son dos, con fórmulas distintas, y las
 * dos valen— pero un mismo `armorClass` leído dos veces no.
 */
export function armorClassOptionsFor(
  classings: Classing[],
  raceId: string,
  subraceId: string,
  characterLevel: number,
  rulesVersion: RulesVersion,
): ArmorClassOption[] {
  const found: ArmorClassOption[] = [];

  for (const classing of classings) {
    if (!classing.classId) continue;

    const cls = classInfoFor(classing.classId, rulesVersion);
    for (const option of cls?.armorClass ?? []) {
      if (option.level <= classing.level) found.push(option as ArmorClassOption);
    }

    if (!classing.subclassId) continue;
    const subclass = subclassInfoFor(classing.subclassId, classing.classId, rulesVersion);
    for (const option of subclass?.armorClass ?? []) {
      if (option.level <= classing.level) found.push(option as ArmorClassOption);
    }
  }

  if (raceId) {
    // `raceInfoFor` ya devuelve la fila del sublinaje cuando hay uno, así que
    // el caparazón de un tortle y las escamas de un linaje llegan por acá sin
    // preguntar dos veces.
    const race = raceInfoFor(raceId, subraceId, rulesVersion);
    for (const option of race?.armorClass ?? []) {
      if (option.level <= characterLevel) found.push(option as ArmorClassOption);
    }
  }

  const seen = new Set<string>();
  return found.filter((option) => {
    const key = `${option.name}|${option.source}|${option.base}|${option.abilities.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
