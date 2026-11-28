import { describe, expect, test } from "vitest";

import { applyAction, type Anvil, type ForgeAction } from "../src/lib/actions";
import { coerceBuilderState, freshDraft } from "../src/lib/builder-state";
import { allOptions, subclassesFor } from "../src/lib/catalog";
import { resolveDraft } from "../src/lib/derive";
import { grantedSpellsFor } from "../src/lib/granted-spells";
import { callingView, giftsView, sheetView, spellsView } from "../src/lib/screens";
import { settleDraft } from "../src/lib/settle";

/**
 * Choices the 2024 Player's Handbook prints on a species, class or subclass
 * that the index does not carry, so nothing ever asked them.
 */

const step = (at: Anvil, action: ForgeAction): Anvil => {
  const next = applyAction(at, action);
  return { draft: settleDraft(next.draft, at.draft), scratch: next.scratch };
};

function built(race: string, classId: string, level: number, subclass = "") {
  let at: Anvil = { draft: { ...freshDraft("5e-2024", false), characterName: "Prueba" }, scratch: { pool: [], bound: [], sets: [] } };
  const pick = (prop: "race" | "class" | "background", id: string) =>
    allOptions(prop, "2024").find((entry) => entry.id === id)!;
  at = step(at, { type: "pick", prop: "race", entry: pick("race", race) });
  at = step(at, { type: "pick", prop: "class", entry: pick("class", classId) });
  at = step(at, { type: "pick", prop: "background", entry: pick("background", "soldier") });
  at = step(at, { type: "setLevel", level });
  if (subclass) {
    const entry = subclassesFor(pick("class", classId).label, "2024", "", 40).find((row) => row.label.includes(subclass))!;
    at = step(at, { type: "pick", prop: "subclass", entry });
  }
  return at;
}

const pool = (at: Anvil, name: string) => callingView(at.draft).pools.find((entry) => entry.name === name);
const choose = (at: Anvil, name: string, option: string) =>
  step(at, { type: "toggleTalent", id: pool(at, name)!.options.find((entry) => entry.label === option)!.id });
const sheet = (at: Anvil) => sheetView(at.draft).sheet!;
const skill = (at: Anvil, name: string) =>
  sheet(at).abilities.flatMap((ability) => ability.skills).find((entry) => entry.name === name.toLowerCase())!.modifier;

describe("elecciones impresas 2024", () => {
  test.each([
    ["dragonborn", "fighter", 1, "", "Draconic Ancestry", 10],
    ["goliath", "fighter", 1, "", "Giant Ancestry", 6],
    ["human", "cleric", 1, "", "Divine Order", 2],
    ["human", "druid", 1, "", "Primal Order", 2],
    ["human", "ranger", 3, "Hunter", "Hunter's Prey", 2],
    ["human", "sorcerer", 6, "Draconic", "Elemental Affinity", 5],
  ])("%s %s %i %s pregunta %s", (race, classId, level, subclass, name, options) => {
    const at = built(race, classId, level, subclass);
    expect(pool(at, name)?.count).toBe(1);
    expect(pool(at, name)!.options).toHaveLength(options);
  });

  test("no pregunta antes de tiempo ni a quien no toca", () => {
    expect(pool(built("human", "ranger", 2), "Hunter's Prey")).toBeUndefined();
    expect(pool(built("human", "sorcerer", 5, "Draconic"), "Elemental Affinity")).toBeUndefined();
    expect(pool(built("human", "fighter", 1), "Divine Order")).toBeUndefined();
  });

  test("la respuesta se ve en la hoja y sobrevive a la recarga", () => {
    let at = built("dragonborn", "fighter", 1);
    at = choose(at, "Draconic Ancestry", "Red (Fire)");
    at = { ...at, draft: coerceBuilderState(JSON.parse(JSON.stringify(at.draft))) };
    expect(callingView(at.draft).talents).toContain(pool(at, "Draconic Ancestry")!.options.find((o) => o.label === "Red (Fire)")!.id);
    expect(sheet(at).speciesTraits).toContain("Draconic Ancestry: Red (Fire)");
    const resolved = resolveDraft(at.draft);
    expect(resolved.status).toBe("ready");
  });

  test("Hunter's Prey aparece entre los rasgos de clase", () => {
    const at = choose(built("human", "ranger", 3, "Hunter"), "Hunter's Prey", "Colossus Slayer");
    expect(sheet(at).classFeatures).toContain("Hunter's Prey: Colossus Slayer");
  });

  test("Protector da armadura pesada y armas marciales; Warden, armadura media", () => {
    const cleric = built("human", "cleric", 1);
    expect(sheet(cleric).armorTraining.heavy).toBe(false);
    expect(sheet(choose(cleric, "Divine Order", "Protector")).armorTraining.heavy).toBe(true);
    const druid = built("human", "druid", 1);
    expect(sheet(druid).armorTraining.medium).toBe(false);
    expect(sheet(choose(druid, "Primal Order", "Warden")).armorTraining.medium).toBe(true);
  });

  test("Thaumaturge y Magician dan un truco más y suman Sabiduría a dos habilidades", () => {
    for (const [classId, name, option, skills] of [
      ["cleric", "Divine Order", "Thaumaturge", ["Arcana", "Religion"]],
      ["druid", "Primal Order", "Magician", ["Arcana", "Nature"]],
    ] as const) {
      const base = built("human", classId, 1);
      const taken = choose(base, name, option);
      const cantrips = (at: Anvil) => spellsView(at.draft).plans[0]!.picker.availableCantripCount;
      expect(cantrips(taken)).toBe(cantrips(base) + 1);
      for (const entry of skills) expect(skill(taken, entry)).toBe(skill(base, entry) + 1);
      expect(skill(taken, "Athletics")).toBe(skill(base, "Athletics"));
    }
  });

  test("el gnomo elige linaje y recibe sus conjuros", () => {
    let at = built("gnome", "fighter", 1);
    const source = spellsView(at.draft).grants.sources.find((entry) => entry.key === "race")!;
    expect(source.variants).toEqual(["Forest Gnome", "Rock Gnome"]);
    at = step(at, { type: "chooseVariant", key: "race", name: "Forest Gnome" });
    expect(grantedSpellsFor(at.draft, "2024").map((entry) => entry.label.toLowerCase()).sort()).toEqual(["minor illusion", "speak with animals"]);
    at = step(at, { type: "chooseVariant", key: "race", name: "Rock Gnome" });
    expect(grantedSpellsFor(at.draft, "2024").map((entry) => entry.label.toLowerCase()).sort()).toEqual(["mending", "prestidigitation"]);
  });

  test("Lore pide tres habilidades, Battle Master una y una herramienta, el bárbaro una a nivel 3", () => {
    const offers = (at: Anvil, label: string) =>
      giftsView(at.draft).offers.filter((offer) => offer.label === label).map((offer) => [offer.kind, offer.count]);
    expect(offers(built("human", "bard", 3, "Lore"), "Bonus Proficiencies")).toEqual([["skill", 3]]);
    expect(offers(built("human", "fighter", 3, "Battle"), "Student of War")).toEqual([["skill", 1], ["tool", 1]]);
    expect(offers(built("human", "barbarian", 3), "Primal Knowledge")).toEqual([["skill", 1]]);
    expect(offers(built("human", "barbarian", 2), "Primal Knowledge")).toEqual([]);
  });
});
