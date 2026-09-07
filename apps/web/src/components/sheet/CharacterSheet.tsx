/**
 * La hoja de personaje: la hoja de roll20, no un dibujo de ella.
 *
 * Los dos intentos anteriores fueron maquetas propias con los nombres de campo
 * de D&D, y eso es lo que esto reemplaza. Lo que se dibuja es el HTML de la
 * hoja *D&D 5E by Roll20* (la OGL, versión 4.21), vendorizado en
 * `apps/web/vendor/roll20-ogl/`, llenado desde el build — el cómo está en
 * `ogl-render.ts`, el qué va dónde en `ogl-attrs.ts`.
 *
 * **La de 2024 no está todavía, a propósito.** La hoja que tenemos es de 2014:
 * no menciona inspiración heroica, ni maestría de armas, ni especies. A un
 * personaje de 2024 se le dice eso en vez de mostrarle una hoja de 2014 con sus
 * números adentro, que sería una hoja en desacuerdo con sus propias reglas.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";

import type { BuilderState } from "@/lib/builder";
import { sheetDataFor } from "@/lib/sheet-data";
import { rulesVersionOf } from "@/lib/vault-store";

import OglSheet from "./OglSheet";

export default function CharacterSheet({
  state,
  build,
}: {
  state: BuilderState;
  /** The derived build. The sheet reads numbers, it does not compute them. */
  build: CharacterBuild;
  /** The class tint. The window wears it; the sheet has its own look. */
  accent?: string;
}) {
  const rulesVersion = rulesVersionOf(state);

  if (rulesVersion === "2024") {
    return (
      <p className="px-8 py-10 font-body text-sm italic text-bone/60">
        La hoja de 2024 todavía no está. Este personaje se armó con las reglas de 2024 y la hoja
        que tenemos es la de 2014; ponerlo en ella sería mostrarlo bajo reglas que no son las
        suyas. Mientras tanto están los recordatorios, y el tomo exporta a Foundry igual.
      </p>
    );
  }

  return <OglSheet data={sheetDataFor(state, build, rulesVersion)} />;
}
