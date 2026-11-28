import { describe, expect, test } from "vitest";

import { applyAction, type Anvil, type ForgeAction } from "../src/lib/actions";
import { freshDraft } from "../src/lib/builder-state";
import { allOptions } from "../src/lib/catalog";
import { spellGrantsFor, unansweredSpellChoices } from "../src/lib/granted-spells";
import { settleDraft } from "../src/lib/settle";

/**
 * A 2024 background prints which list its Magic Initiate draws from: Acolyte
 * the cleric's, Guide the druid's, Sage the wizard's. The Forge offered all
 * three, so a guide could leave with cleric spells.
 */

const step = (at: Anvil, action: ForgeAction): Anvil => {
  const next = applyAction(at, action);
  return { draft: settleDraft(next.draft, at.draft), scratch: next.scratch };
};

function withBackground(id: string) {
  let at: Anvil = { draft: { ...freshDraft("5e-2024"), characterName: "Prueba" }, scratch: { pool: [], bound: [], sets: [] } };
  const pick = (prop: "race" | "class" | "background", entry: string) =>
    allOptions(prop, "2024").find((row) => row.id === entry)!;
  at = step(at, { type: "pick", prop: "race", entry: pick("race", "dwarf") });
  at = step(at, { type: "pick", prop: "class", entry: pick("class", "cleric") });
  at = step(at, { type: "pick", prop: "background", entry: pick("background", id) });
  return at;
}

describe("Magic Initiate de trasfondo", () => {
  test.each([
    ["acolyte", "cleric"],
    ["guide", "druid"],
    ["sage", "wizard"],
  ])("%s ofrece solo la lista de %s y no pregunta cuál", (background, list) => {
    const at = withBackground(background);
    const grant = spellGrantsFor(at.draft, "2024").find((source) => source.key === "feat:magic-initiate")!;
    expect(grant.variants).toEqual([]);
    const filters = grant.entries.flatMap((entry) => entry.filters.map((filter) => filter.filter.toLowerCase()));
    expect(filters.sort()).toEqual([`level=0|class=${list}`, `level=1|class=${list}`]);
    const asked = unansweredSpellChoices(at.draft, "2024").filter((question) => question.key.startsWith("feat:magic-initiate"));
    expect(asked.length).toBeGreaterThan(0);
  });
});
