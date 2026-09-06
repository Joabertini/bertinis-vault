/**
 * The character sheet: the real one, whichever one this character plays with.
 *
 * Not a layout of my own using D&D's field names — that was the first attempt
 * and it was wrong. A player opening this should see the sheet they already
 * own: the 2014 sheet for a 2014 character, the 2024 sheet for a 2024 one.
 * They are different documents, not one document with a couple of renamed
 * boxes, so they are drawn as two (`LegacySheet`, `ModernSheet`) over one
 * gathering of facts (`sheet-data.ts`).
 *
 * The edition is not a setting on the sheet: it is `state.rulesVersion`, the
 * same switch the rest of the app reads. A character cannot be shown the wrong
 * sheet because there is nowhere to choose one.
 *
 * Every number comes off the derived build — the same object the Foundry export
 * sends — so the sheet and the export cannot disagree. The boxes a player fills
 * in at the table are drawn empty, the way a printed sheet has them: this
 * builder holds choices, not a session, and a zero there would be a claim.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";

import type { BuilderState } from "@/lib/builder";
import { sheetDataFor } from "@/lib/sheet-data";
import { rulesVersionOf } from "@/lib/vault-store";

import LegacySheet from "./LegacySheet";
import ModernSheet from "./ModernSheet";

export default function CharacterSheet({
  state,
  build,
}: {
  state: BuilderState;
  /** The derived build. The sheet reads numbers, it does not compute them. */
  build: CharacterBuild;
  /** The class tint. The window wears it; paper does not. */
  accent?: string;
}) {
  const rulesVersion = rulesVersionOf(state);
  const data = sheetDataFor(state, build, rulesVersion);

  return rulesVersion === "2024" ? <ModernSheet data={data} /> : <LegacySheet data={data} />;
}
