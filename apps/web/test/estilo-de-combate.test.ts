import { describe, expect, test } from "vitest";

import { applyAction, type Anvil, type ForgeAction } from "../src/lib/actions";
import { coerceBuilderState, freshDraft } from "../src/lib/builder-state";
import { allOptions, subclassesFor } from "../src/lib/catalog";
import { resolveDraft } from "../src/lib/derive";
import { featIdsFor } from "../src/lib/feats";
import { unansweredSpellChoices } from "../src/lib/granted-spells";
import { talentsSatisfied } from "../src/lib/optional-features";
import { callingView, sheetView } from "../src/lib/screens";
import { settleDraft } from "../src/lib/settle";

/**
 * In 2024 a fighting style is a feat the class hands over: fighter at 1, paladin
 * and ranger at 2, a champion again at 7. The Forge never asked for it, so every
 * 2024 martial left without the +2 of Archery or the +1 AC of Defense.
 */

const step = (at: Anvil, action: ForgeAction): Anvil => {
  const next = applyAction(at, action);
  return { draft: settleDraft(next.draft, at.draft), scratch: next.scratch };
};

function built(edition: "5e-2014" | "5e-2024", classId: string, level: number, subclass = "") {
  const version = edition === "5e-2024" ? "2024" : "2014";
  let at: Anvil = { draft: { ...freshDraft(edition), characterName: "Prueba" }, scratch: { pool: [], bound: [], sets: [] } };
  const pick = (prop: "race" | "class" | "background", id: string) =>
    allOptions(prop, version).find((entry) => entry.id === id)!;
  at = step(at, { type: "pick", prop: "race", entry: pick("race", "human") });
  at = step(at, { type: "pick", prop: "class", entry: pick("class", classId) });
  at = step(at, { type: "pick", prop: "background", entry: pick("background", "soldier") });
  at = step(at, { type: "setLevel", level });
  if (subclass) {
    const label = pick("class", classId).label;
    const entry = subclassesFor(label, version).find((row) => row.label === subclass)!;
    at = step(at, { type: "pick", prop: "subclass", entry });
  }
  return at;
}

// The style questions are the pools whose options are `style:<grant>|<feat>`; 2014's optional-feature pool keeps its own ids.
const stylePools = (at: Anvil) =>
  callingView(at.draft).pools.filter((pool) => pool.options.some((option) => option.id.startsWith("style:")));
const optionOf = (at: Anvil, featId: string, index = 0) =>
  stylePools(at)[index]!.options.find((option) => option.id.endsWith(`|${featId}`))!;

describe("estilo de combate 2024", () => {
  test("el guerrero lo elige a nivel 1, entre las dotes de estilo", () => {
    const at = built("5e-2024", "fighter", 1);
    const pools = stylePools(at);
    expect(pools).toHaveLength(1);
    expect(pools[0]!.count).toBe(1);
    const ids = pools[0]!.options.map((option) => option.id.split("|")[1]);
    expect(ids).toEqual(expect.arrayContaining(["archery", "defense", "great-weapon-fighting", "dueling"]));
    expect(ids).not.toContain("alert");
    expect(talentsSatisfied(callingView(at.draft).pools, callingView(at.draft).talents)).toBe(false);
  });

  test("elegido, es una dote del personaje y sobrevive a la recarga", () => {
    let at = built("5e-2024", "fighter", 1);
    at = step(at, { type: "toggleTalent", id: optionOf(at, "archery").id });
    const draft = coerceBuilderState(JSON.parse(JSON.stringify(at.draft)));
    expect(featIdsFor(draft)).toContain("archery");
    const view = callingView(draft);
    expect(talentsSatisfied(view.pools, view.talents)).toBe(true);
    const resolved = resolveDraft(draft);
    expect(resolved.status).toBe("ready");
    expect(JSON.stringify(resolved.status === "ready" ? resolved.snapshot : null)).toContain("archery");
  });

  test("elegir otro estilo cambia el anterior", () => {
    let at = built("5e-2024", "fighter", 1);
    at = step(at, { type: "toggleTalent", id: optionOf(at, "archery").id });
    at = step(at, { type: "toggleTalent", id: optionOf(at, "defense").id });
    expect(featIdsFor(at.draft).filter((id) => ["archery", "defense"].includes(id))).toEqual(["defense"]);
  });

  test("paladín y explorador a nivel 2, con su alternativa propia", () => {
    expect(stylePools(built("5e-2024", "paladin", 1))).toHaveLength(0);
    const paladin = stylePools(built("5e-2024", "paladin", 2));
    expect(paladin).toHaveLength(1);
    expect(paladin[0]!.options.map((option) => option.id.split("|")[1])).toContain("blessed-warrior");
    const ranger = stylePools(built("5e-2024", "ranger", 2));
    expect(ranger[0]!.options.map((option) => option.id.split("|")[1])).toContain("druidic-warrior");
  });

  test("el campeón suma otro a nivel 7, y no puede repetir el primero", () => {
    let at = built("5e-2024", "fighter", 7, "Champion");
    expect(stylePools(at)).toHaveLength(2);
    at = step(at, { type: "toggleTalent", id: optionOf(at, "archery").id });
    expect(optionOf(at, "archery", 1).eligible).toBe(false);
  });

  test("Archery suma 2 al ataque a distancia y nada al cuerpo a cuerpo", () => {
    const item = (prop: "weapon" | "armor", id: string, label: string): ForgeAction =>
      ({ type: "pick", prop, entry: { id, label, source: "XPHB", shared: false } });
    let base = built("5e-2024", "fighter", 1);
    base = step(base, item("weapon", "longbow", "Longbow"));
    base = step(base, { type: "patch", patch: { extraEquipmentText: "longbow\ngreatsword" } });
    const attack = (at: Anvil, name: string) => sheetView(at.draft).sheet!.attacks.find((line) => line.name === name)!.attackBonus;
    const archer = step(base, { type: "toggleTalent", id: optionOf(base, "archery").id });
    expect(attack(archer, "Longbow")).toBe(attack(base, "Longbow") + 2);
    expect(attack(archer, "Greatsword")).toBe(attack(base, "Greatsword"));
  });

  test("Defense suma 1 a la CA con armadura puesta, y no sin ella", () => {
    const naked = built("5e-2024", "fighter", 1);
    const armored = step(naked, { type: "pick", prop: "armor", entry: { id: "chain-mail", label: "Chain Mail", source: "XPHB", shared: false } });
    const ac = (at: Anvil) => sheetView(at.draft).sheet!.armorClass;
    const withDefense = (at: Anvil) => step(at, { type: "toggleTalent", id: optionOf(at, "defense").id });
    expect(ac(withDefense(armored))).toBe(ac(armored) + 1);
    expect(ac(withDefense(naked))).toBe(ac(naked));
  });

  test("en 2014 el estilo opcional también cuenta en la hoja", () => {
    let at = built("5e-2014", "fighter", 1);
    at = step(at, { type: "pick", prop: "armor", entry: { id: "chain-mail", label: "Chain Mail", source: "PHB", shared: false } });
    const before = sheetView(at.draft).sheet!.armorClass;
    at = step(at, { type: "toggleTalent", id: "defense" });
    expect(sheetView(at.draft).sheet!.armorClass).toBe(before + 1);
  });

  test("un estilo ya tomado como dote de nivel no se puede repetir", () => {
    let at = built("5e-2024", "fighter", 4);
    at = step(at, { type: "setLevelChoice", key: "4", choice: { kind: "feat", featId: "defense" } });
    expect(optionOf(at, "defense").eligible).toBe(false);
  });

  test("Blessed Warrior pide sus dos trucos en la cámara de Clase", () => {
    let at = built("5e-2024", "paladin", 2);
    at = step(at, { type: "toggleTalent", id: optionOf(at, "blessed-warrior").id });
    const asked = unansweredSpellChoices(at.draft, "2024").filter((question) => question.key.startsWith("feat:blessed-warrior"));
    expect(asked.map((question) => [question.chamber, question.count])).toEqual([["class", 2]]);
  });

  test("en 2014 sigue siendo un rasgo opcional, no esta pregunta", () => {
    expect(stylePools(built("5e-2014", "fighter", 1))).toHaveLength(0);
  });
});
