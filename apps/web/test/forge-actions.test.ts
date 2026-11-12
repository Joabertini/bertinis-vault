import { describe, expect, test } from "vitest";

import { applyAction, hasProgress, type Anvil, type ForgeAction } from "../src/lib/actions";
import { ABILITY_IDS } from "../src/lib/abilities";
import { coerceBuilderState, freshDraft, initialState, rulesVersionOf } from "../src/lib/builder-state";
import { allOptions } from "../src/lib/catalog";
import { classEntriesFor } from "../src/lib/classing";
import { resolveDraft } from "../src/lib/derive";
import { toLines } from "../src/lib/grants";
import { levellingFor } from "../src/lib/index-options";
import { settleDraft, settleKit, settlePrintedBonus, settleSpeciesSeed } from "../src/lib/settle";
import { spellPlansFor, strayChoices } from "../src/lib/spells";
import { ROLL_ATTEMPTS, pointBuyFloor } from "../src/lib/stat-methods";

/**
 * The choices, driven without a page.
 *
 * Every test here goes the way a player's click goes: an action, the draft it
 * leaves, and then whatever reads that draft next — the derivation, the store's
 * reload. A rule that only holds inside the action is the kind that used to
 * break one layer further on.
 */

const anvil = (patch: Partial<typeof initialState> = {}): Anvil => ({
  draft: { ...initialState, ...patch },
  scratch: { pool: [], bound: [], sets: [] },
});

const run = (start: Anvil, actions: ForgeAction[]) =>
  actions.reduce<Anvil>((at, action) => applyAction(at, action), start);

/** What a reload gives back: the draft as JSON, read through the store's coercion. */
const reloaded = (draft: typeof initialState) =>
  coerceBuilderState(JSON.parse(JSON.stringify(draft)));

describe("the dice", () => {
  const rolled = [15, 14, 13, 12, 10, 8];

  test("a kept set, bound one score at a time, is the six abilities", () => {
    const end = run(anvil(), [
      { type: "roll", rolled },
      { type: "keepSet", index: 0 },
      ...ABILITY_IDS.map((ability, at) => ({ type: "bindScore", ability, value: rolled[at]! }) as const),
    ]);

    expect(ABILITY_IDS.map((ability) => end.draft[ability])).toEqual(rolled);
    expect(end.scratch.pool).toEqual([]);
    expect(end.scratch.bound).toEqual([...ABILITY_IDS]);
    expect(end.draft.statMethod).toBe("roll");
  });

  test("the bound scores are the ones the derivation reads", () => {
    const end = run(anvil(), [
      { type: "roll", rolled },
      { type: "keepSet", index: 0 },
      ...ABILITY_IDS.map((ability, at) => ({ type: "bindScore", ability, value: rolled[at]! }) as const),
    ]);

    const resolved = resolveDraft(end.draft);
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(ABILITY_IDS.map((ability) => resolved.snapshot.abilities.base[ability])).toEqual(rolled);
  });

  test("releasing a score puts it back in the pool and unbinds the ability", () => {
    const start = run(anvil(), [
      { type: "roll", rolled },
      { type: "keepSet", index: 0 },
      { type: "bindScore", ability: "str", value: 15 },
    ]);
    const end = applyAction(start, { type: "releaseScore", ability: "str" });

    expect(end.draft.str).toBe(10);
    expect(end.scratch.bound).toEqual([]);
    expect([...end.scratch.pool].sort()).toEqual([...rolled].sort());
  });

  test("a score that is not in the pool binds nothing", () => {
    const start = run(anvil(), [{ type: "roll", rolled }, { type: "keepSet", index: 0 }]);
    expect(applyAction(start, { type: "bindScore", ability: "str", value: 18 })).toBe(start);
  });

  test("only the last throws are kept", () => {
    const throws = Array.from({ length: ROLL_ATTEMPTS + 2 }, (_, at) => [at, at, at, at, at, at]);
    const end = run(anvil(), throws.map((set) => ({ type: "roll", rolled: set }) as const));

    expect(end.scratch.sets).toEqual(throws.slice(-ROLL_ATTEMPTS));
  });

  test("switching to point buy lays the floor and keeps the throws", () => {
    const start = run(anvil({ statMethod: "roll" }), [{ type: "roll", rolled }, { type: "keepSet", index: 0 }]);
    const end = applyAction(start, { type: "chooseStatMethod", method: "pointbuy" });

    expect(end.draft.statMethod).toBe("pointbuy");
    expect(ABILITY_IDS.map((ability) => end.draft[ability])).toEqual(Object.values(pointBuyFloor()));
    expect(end.scratch.pool).toEqual([]);
    expect(end.scratch.sets).toEqual([rolled]);
  });

  test("choosing the method already chosen changes nothing", () => {
    const start = anvil({ statMethod: "manual" });
    expect(applyAction(start, { type: "chooseStatMethod", method: "manual" })).toBe(start);
  });
});

describe("levels", () => {
  test("lowering the level drops what was earned above it, and only this class's", () => {
    const improvement = { kind: "improvement", bonuses: { int: 2 } } as const;
    const start = anvil({
      level: 8,
      levelChoices: { "4": improvement, "8": improvement, "wizard:4": improvement },
    });
    const end = applyAction(start, { type: "setLevel", level: 4 });

    expect(end.draft.level).toBe(4);
    expect(Object.keys(end.draft.levelChoices).sort()).toEqual(["4", "wizard:4"]);
  });

  test("a level below the subclass level gives the subclass back", () => {
    const start = anvil();
    const at = levellingFor(start.draft.classId, rulesVersionOf(start.draft)).subclassLevel ?? 3;
    expect(start.draft.subclassId).not.toBe("");

    expect(applyAction(start, { type: "setLevel", level: at }).draft.subclassId).toBe(start.draft.subclassId);
    if (at > 1) {
      expect(applyAction(start, { type: "setLevel", level: at - 1 }).draft.subclassId).toBe("");
    }
  });

  test("after a level change, no spell is left that no class offers", () => {
    const start = anvil();
    const end = applyAction(start, { type: "setLevel", level: 1 });
    const rulesVersion = rulesVersionOf(end.draft);
    const resolved = resolveDraft(end.draft);
    const classes = allOptions("class", rulesVersion);

    const plans = spellPlansFor({
      entries: classEntriesFor(
        { classId: end.draft.classId, subclassId: end.draft.subclassId, level: end.draft.level },
        end.draft.extraClasses,
        rulesVersion,
      ),
      labelFor: (classId) => {
        const found = classes.find((entry) => entry.id === classId);
        return { label: found?.label ?? classId, source: found?.source ?? "" };
      },
      rulesVersion,
      snapshot: resolved.status === "ready" ? resolved.snapshot : null,
      spellbook: toLines(end.draft.spellbookText),
    });
    const stray = strayChoices(plans, {
      cantrips: toLines(end.draft.cantripsText),
      spells: toLines(end.draft.spellsText),
      book: toLines(end.draft.spellbookText),
    });

    expect(stray).toEqual({ cantrips: [], spells: [], book: [] });
  });

  test("a change that takes spells with it says so, and one that does not says nothing", () => {
    const start = anvil();
    const lowered = applyAction(start, { type: "setLevel", level: 1 });
    const dropped = toLines(start.draft.spellsText).length - toLines(lowered.draft.spellsText).length;

    if (dropped > 0) expect(lowered.shed?.length).toBeGreaterThan(0);
    else expect(lowered.shed).toBeUndefined();

    expect(applyAction(start, { type: "toggleMastery", id: "longsword" }).shed).toBeUndefined();
  });
});

describe("spells", () => {
  test("erasing a spell from the book unprepares it", () => {
    const line = "Nv1: Shield";
    const start = anvil({ spellbookText: line, spellsText: line });
    const end = applyAction(start, { type: "toggleBookSpell", line });

    expect(end.draft.spellbookText).toBe("");
    expect(end.draft.spellsText).toBe("");
  });

  test("writing a spell into the book does not prepare it", () => {
    const start = anvil({ spellbookText: "", spellsText: "" });
    const end = applyAction(start, { type: "toggleBookSpell", line: "Nv1: Shield" });

    expect(toLines(end.draft.spellbookText)).toEqual(["Nv1: Shield"]);
    expect(end.draft.spellsText).toBe("");
  });

  test("a toggle taken twice leaves the list as it was", () => {
    const start = anvil();
    const twice = run(start, [
      { type: "toggleCantrip", value: "Light" },
      { type: "toggleCantrip", value: "Light" },
    ]);

    expect(twice.draft.cantripsText).toBe(start.draft.cantripsText);
  });
});

describe("expertise", () => {
  test("the same pick chooses and unchooses", () => {
    const pick = { type: "answerExpertise", key: "rogue:1", setIndex: 0, of: "skills", id: "stealth" } as const;
    const once = applyAction(anvil(), pick);
    expect(once.draft.expertiseChoices["rogue:1"]).toEqual({ setIndex: 0, skills: ["stealth"], tools: [] });

    const twice = applyAction(once, pick);
    expect(twice.draft.expertiseChoices["rogue:1"]).toEqual({ setIndex: 0, skills: [], tools: [] });
  });

  test("spending the grant on another set clears the picks", () => {
    const end = run(anvil(), [
      { type: "answerExpertise", key: "rogue:1", setIndex: 0, of: "skills", id: "stealth" },
      { type: "answerExpertise", key: "rogue:1", setIndex: 1, of: "tools", id: "thieves-tools" },
    ]);

    expect(end.draft.expertiseChoices["rogue:1"]).toEqual({ setIndex: 1, skills: [], tools: ["thieves-tools"] });
  });
});

describe("hit points", () => {
  test("clearing a roll removes it rather than storing a zero", () => {
    const end = run(anvil(), [
      { type: "setHitPointRoll", level: 2, roll: 5 },
      { type: "setHitPointRoll", level: 3, roll: 4 },
      { type: "setHitPointRoll", level: 2, roll: null },
    ]);

    expect(end.draft.hpRolls).toEqual({ "3": 4 });
  });
});

describe("what a choice wrote survives a reload", () => {
  test("every action's draft reads back the same", () => {
    const improvement = { kind: "improvement", bonuses: { int: 2 } } as const;
    const end = run(anvil({ level: 8 }), [
      { type: "roll", rolled: [15, 14, 13, 12, 10, 8] },
      { type: "keepSet", index: 0 },
      { type: "bindScore", ability: "int", value: 15 },
      { type: "setLevelChoice", key: "4", choice: improvement },
      { type: "setFeatAbilities", featId: "resilient", bonuses: { con: 1 } },
      { type: "setHitPointRoll", level: 2, roll: 5 },
      { type: "toggleMastery", id: "longsword" },
      { type: "toggleAttunement", id: "cloak-of-protection" },
      { type: "answerExpertise", key: "rogue:1", setIndex: 0, of: "skills", id: "stealth" },
      { type: "addClass" },
      { type: "changeClass", index: 0, next: { classId: "cleric", subclassId: "", level: 1 } },
      { type: "toggleCantrip", value: "Light" },
      { type: "setLevel", level: 6 },
    ]);

    expect(reloaded(end.draft)).toEqual(end.draft);
  });
});

describe("picking from the catalog", () => {
  const races = allOptions("race", "2014");
  const classes = allOptions("class", "2014");
  const dwarf = races.find((entry) => entry.label === "Dwarf")!;
  const elf = races.find((entry) => entry.label === "Elf")!;
  const wizard = classes.find((entry) => entry.label === "Wizard")!;
  const fighter = classes.find((entry) => entry.label === "Fighter")!;

  test("a species is written with the book it came from", () => {
    const end = applyAction(anvil({ raceId: "", sourceBooks: {}, abilityBonuses: {}, subraceId: "", sizeChoice: "" }), {
      type: "pick",
      prop: "race",
      entry: dwarf,
    });
    expect(end.draft.raceId).toBe(dwarf.id);
    expect(end.draft.sourceBooks[`race:${dwarf.id}`]).toBe(dwarf.source);
    expect(end.shed).toEqual([]);
  });

  test("picking the same entry again clears it", () => {
    const end = run(anvil({ raceId: "" }), [
      { type: "pick", prop: "race", entry: dwarf },
      { type: "pick", prop: "race", entry: dwarf },
    ]);
    expect(end.draft.raceId).toBe("");
  });

  test("a new species lets go of the old one's subrace, size and bonus, and says so", () => {
    const end = applyAction(
      anvil({ raceId: dwarf.id, subraceId: "hill", sizeChoice: "M", abilityBonuses: { con: 2 } }),
      { type: "pick", prop: "race", entry: elf },
    );
    expect(end.draft.subraceId).toBe("");
    expect(end.draft.sizeChoice).toBe("");
    expect(end.draft.abilityBonuses).toEqual({});
    expect(end.shed).toEqual(["la subraza", "la mejora de especie", "el tamano elegido"]);
  });

  test("a new class takes the old one's spells with it", () => {
    const start = anvil({ classId: wizard.id, cantripsText: "Fire Bolt", spellsText: "Shield", spellbookText: "Shield" });
    const end = applyAction(start, { type: "pick", prop: "class", entry: fighter });
    expect(end.draft.classId).toBe(fighter.id);
    expect([end.draft.cantripsText, end.draft.spellsText, end.draft.spellbookText]).toEqual(["", "", ""]);
    expect(end.shed).toContain("los conjuros");
    expect(resolveDraft(reloaded(end.draft)).status).toBeDefined();
  });

  test("a background change drops only a chosen feat", () => {
    const backgrounds = allOptions("background", "2024");
    const first = backgrounds[0]!;
    const end = applyAction(anvil({ rulesVersion: "5e-2024", backgroundFeatId: "alert" }), {
      type: "pick",
      prop: "background",
      entry: first,
    });
    expect(end.draft.backgroundFeatId).toBe("");
    expect(end.shed).toEqual(["la dote del trasfondo"]);
  });

  test("a patch writes the fields it names and nothing else", () => {
    const start = anvil();
    const end = applyAction(start, { type: "patch", patch: { characterName: "Ilse" } });
    expect(end.draft).toEqual({ ...start.draft, characterName: "Ilse" });
  });

  test("a fresh draft carries the edition and none of the demo character", () => {
    const draft = freshDraft("5e-2024", false);
    expect([draft.rulesVersion, draft.supplements, draft.characterName, draft.raceId, draft.level]).toEqual([
      "5e-2024",
      false,
      "",
      "",
      1,
    ]);
    expect(hasProgress(draft)).toBe(false);
    expect(hasProgress({ ...draft, characterName: "Ilse" })).toBe(true);
  });
});

describe("what the Forge settles on its own", () => {
  const races = allOptions("race", "2014");
  const dwarf = races.find((entry) => entry.label === "Dwarf")!;
  const classes = allOptions("class", "2014");
  const fighter = classes.find((entry) => entry.label === "Fighter")!;
  const wizard = classes.find((entry) => entry.label === "Wizard")!;

  const pickAndSettle = (draft: typeof initialState, prop: "race" | "class", entry: typeof dwarf) => {
    const picked = applyAction({ draft, scratch: { pool: [], bound: [], sets: [] } }, { type: "pick", prop, entry });
    return settleDraft(picked.draft, draft);
  };

  test("a 2014 dwarf brings its printed Constitution", () => {
    const start = settleDraft(freshDraft("5e-2014"));
    const end = pickAndSettle(start, "race", dwarf);
    expect(end.abilityBonuses.con).toBe(2);
  });

  test("a new class swaps the kit instead of stacking it", () => {
    const start = settleDraft(freshDraft("5e-2014"));
    const asFighter = pickAndSettle(start, "class", fighter);
    const asWizard = pickAndSettle(asFighter, "class", wizard);
    expect(asFighter.kitAppliedFor).toBe(`${fighter.id}||5e-2014`);
    expect(asWizard.kitAppliedFor).toBe(`${wizard.id}||5e-2014`);
    expect(asWizard.extraEquipmentText).not.toBe(asFighter.extraEquipmentText);
  });

  test("a settled draft stays as it is", () => {
    const start = settleDraft(freshDraft("5e-2014"));
    const end = pickAndSettle(pickAndSettle(start, "race", dwarf), "class", fighter);
    expect(settleDraft(end, end)).toBe(end);
    expect(settleDraft(end)).toEqual(end);
  });

  test("each rule is the effect's own: nothing to do on a draft that agrees", () => {
    const end = pickAndSettle(settleDraft(freshDraft("5e-2014")), "race", dwarf);
    expect(settleSpeciesSeed(end)).toBeNull();
    expect(settlePrintedBonus(end)).toBeNull();
    expect(settleKit(end)).toBeNull();
  });
});

describe("gifts and gear", () => {
  const start = () => ({ draft: settleDraft(freshDraft("5e-2014")), scratch: { pool: [], bound: [], sets: [] } });

  test("a chosen skill goes after the granted ones, and toggles off", () => {
    const on = applyAction(start(), { type: "toggleProficiency", value: "Perception" });
    expect(toLines(on.draft.proficienciesText)).toContain("Perception");
    const off = applyAction(on, { type: "toggleProficiency", value: "Perception" });
    expect(toLines(off.draft.proficienciesText)).not.toContain("Perception");
  });

  test("a written language is added once", () => {
    const once = applyAction(start(), { type: "writeLanguage", value: " Sylvan " });
    const twice = applyAction(once, { type: "writeLanguage", value: "Sylvan" });
    expect(toLines(twice.draft.languagesText).filter((line) => line === "Sylvan")).toHaveLength(1);
  });

  test("gear is added with its book and removed by id", () => {
    const entry = { id: "rope-hempen-50-feet", label: "Rope", source: "PHB", shared: false };
    const added = applyAction(start(), { type: "addGear", entry });
    expect(toLines(added.draft.extraEquipmentText)).toContain(entry.id);
    expect(added.draft.sourceBooks[`item:${entry.id}`]).toBe("PHB");
    const removed = applyAction(added, { type: "removeGear", id: entry.id });
    expect(toLines(removed.draft.extraEquipmentText)).not.toContain(entry.id);
  });

  test("a talent toggles, and a granted spell answer toggles under its key", () => {
    const talent = applyAction(start(), { type: "toggleTalent", id: "agonizing-blast" });
    expect(talent.draft.optionalFeatureIds).toEqual(["agonizing-blast"]);
    const spell = applyAction(talent, { type: "toggleGrantedSpell", key: "k", name: "Light" });
    expect(spell.draft.grantedSpellChoices.k).toEqual(["Light"]);
  });
});
