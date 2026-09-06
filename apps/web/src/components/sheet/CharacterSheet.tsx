/**
 * The character sheet: the roll20 sheet, not a drawing of it.
 *
 * Two attempts before this one were layouts of my own using D&D's field names,
 * and that is the thing this replaces. What renders is the Shaped sheet's own
 * HTML and its own stylesheet, vendored under `apps/web/vendor/5eshaped/`,
 * filled from the build — see `shaped-render.ts` for how, `shaped-attrs.ts` for
 * which number goes where.
 *
 * **2024 is not here yet, on purpose.** Both sheets we have are 2014 documents
 * — neither mentions Heroic Inspiration, weapon mastery or species — so there
 * is nothing to render a 2024 character *into*. A 2024 character is told that
 * rather than shown a 2014 sheet with its numbers in it, which would be a sheet
 * that quietly disagrees with the rules the character was built under.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";

import type { BuilderState } from "@/lib/builder";
import { sheetDataFor } from "@/lib/sheet-data";
import { rulesVersionOf } from "@/lib/vault-store";

import ShapedSheet from "./ShapedSheet";

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

  return <ShapedSheet data={sheetDataFor(state, build, rulesVersion)} />;
}
