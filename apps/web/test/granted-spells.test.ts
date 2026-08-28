import { describe, expect, test } from "vitest";

import {
  grantedSpellChoicesFor,
  grantedSpellsFor,
  spellGrantsFor,
  unansweredAbilities,
  unansweredSpellChoices,
  unansweredVariants,
} from "../src/lib/granted-spells";
import { initialState } from "../src/lib/builder";
import { slugOf } from "../src/lib/index-options";

const draft = (over: Record<string, unknown> = {}) => ({
  ...initialState,
  rulesVersion: "5e-2024" as const,
  raceId: slugOf("Elf"),
  // Four books print an Elf legal in 2024 and they grant different spells.
  // A draft records the book, so the test does too.
  sourceBooks: { [`race:${slugOf("Elf")}`]: "XPHB" },
  subraceId: "",
  classId: "fighter",
  subclassId: "",
  level: 3,
  spellVariantChoices: {},
  spellAbilityChoices: {},
  // The demo draft ships a feat and a background of its own, and both grant
  // spells now. Cleared so each test names what it is about.
  featId: "",
  backgroundId: "",
  optionalFeatureIds: [],
  levelChoices: {},
  grantedSpellChoices: {},
  cantripsText: "",
  spellsText: "",
  spellbookText: "",
  ...over,
});

describe("what a species grants without being asked", () => {
  test("a 2024 elf is asked its lineage, because nothing else in the data asks", () => {
    /*
     * XPHB ships zero subraces. The elf's Drow, High Elf and Wood Elf exist
     * only as the names on its spell blocks, so before this the choice could
     * not be made at all.
     */
    const [species] = spellGrantsFor(draft(), "2024");

    expect(species?.variants).toEqual(["Drow", "High Elf", "Wood Elf"]);
    expect(species?.chamber).toBe("species");
    expect(unansweredVariants(draft(), "2024").map((source) => source.key)).toEqual(["race"]);
  });

  test("an unanswered lineage grants nothing, rather than all three", () => {
    expect(grantedSpellsFor(draft(), "2024")).toEqual([]);
  });

  test("the chosen lineage brings its cantrip and its daily spell", () => {
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "Drow" } }), "2024");

    expect(spells.map((entry) => entry.label)).toEqual(["dancing lights", "faerie fire"]);
    expect(unansweredVariants(draft({ spellVariantChoices: { race: "Drow" } }), "2024")).toEqual([]);
  });

  test("a granted daily spell is cast innately, not out of a slot", () => {
    // A level 1 slot for something the species hands over free would be the
    // fighter paying for magic they do not have.
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "Drow" } }), "2024");
    const faerieFire = spells.find((entry) => entry.label === "faerie fire");

    expect(faerieFire?.method).toBe("innate");
    expect(faerieFire?.uses).toEqual({ max: 1, period: "day" });
    // Innate or not, it is castable, which is what `prepared` means.
    expect(faerieFire?.preparation).toBe("prepared");
  });

  test("the species gate counts the character's level and not a class's", () => {
    // The drow's Faerie Fire arrives at character level 3 whatever they took
    // those levels in.
    const atOne = grantedSpellsFor(
      draft({ level: 1, spellVariantChoices: { race: "Drow" } }),
      "2024",
    );

    expect(atOne.map((entry) => entry.label)).toEqual(["dancing lights"]);
  });

  test("a grant with no alternatives simply applies", () => {
    // The 2014 tiefling has one list and no lineage question.
    const spells = grantedSpellsFor(
      draft({
        rulesVersion: "5e-2014",
        raceId: slugOf("Tiefling"),
        sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
        level: 5,
      }),
      "2014",
    );

    expect(spells.map((entry) => entry.label)).toContain("thaumaturgy");
    expect(spells.every((entry) => entry.grantedBy === "Tiefling")).toBe(true);
  });

  test("a filter is not a grant: nothing is chosen for the player", () => {
    /*
     * The high elf's level 1 grant is "any wizard cantrip", and choosing one
     * would put a spell on the sheet the player never picked. Its level 3
     * spell is named outright and does arrive — the same lineage states both
     * ways, which is why the difference is read rather than assumed.
     */
    const spells = grantedSpellsFor(draft({ spellVariantChoices: { race: "High Elf" } }), "2024");

    expect(spells.map((entry) => entry.label)).toEqual(["detect magic"]);
  });
});

describe("what a subclass grants, as opposed to offers", () => {
  const cleric = (over: Record<string, unknown> = {}) =>
    draft({
      rulesVersion: "5e-2014" as const,
      raceId: slugOf("Human"),
      sourceBooks: { [`race:${slugOf("Human")}`]: "PHB" },
      classId: "cleric",
      subclassId: "life-domain",
      level: 3,
      ...over,
    });

  test("a domain's spells are always prepared, and do not cost a preparation", () => {
    /*
     * This is what dnd5e's third preparation state is for. Before, the domain
     * only widened the picker, so a Life Domain cleric spent one of the day's
     * preparations on a Bless the domain hands over.
     */
    const spells = grantedSpellsFor(cleric(), "2014");

    expect(spells.map((entry) => entry.label)).toEqual([
      "bless",
      "cure wounds",
      "lesser restoration",
      "spiritual weapon",
    ]);
    expect(spells.every((entry) => entry.preparation === "always")).toBe(true);
  });

  test("a domain's later spells wait for the class level that grants them", () => {
    // And it is the *class* level, which is the gate a subclass states.
    expect(grantedSpellsFor(cleric({ level: 1 }), "2014").map((entry) => entry.label)).toEqual([
      "bless",
      "cure wounds",
    ]);
  });

  test("the subclass question is asked in the class chamber, not beside the spells", () => {
    // Circle of the Land picks a terrain, and a druid looks for that where
    // they picked the circle.
    const land = spellGrantsFor(
      cleric({ classId: "druid", subclassId: "circle-of-the-land", level: 3 }),
      "2014",
    ).find((source) => source.chamber === "class");

    expect(land?.chamber).toBe("class");
    expect(land?.variants).toContain("Arctic");
  });
});

describe("with what a granted spell is cast", () => {
  const elf = (over: Record<string, unknown> = {}) =>
    draft({ spellVariantChoices: { race: "Drow" }, ...over });

  test("an ability the grant fixes needs no question", () => {
    // The 2014 tiefling casts with Charisma and says so.
    const spells = grantedSpellsFor(
      draft({
        rulesVersion: "5e-2014",
        raceId: slugOf("Tiefling"),
        sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
        level: 5,
      }),
      "2014",
    );

    expect(spells.every((entry) => entry.ability === "cha")).toBe(true);
    expect(unansweredAbilities(draft(), "2024")).toEqual([]);
  });

  test("an unanswered choice leaves the spell without one, rather than guessing", () => {
    /*
     * Picking one would set a save DC the player never chose. Left unanswered
     * the spell has none, which shows on the sheet instead of being wrong on
     * it.
     */
    expect(grantedSpellsFor(elf(), "2024").every((entry) => entry.ability === undefined)).toBe(true);
    expect(unansweredAbilities(elf(), "2024").map((source) => source.key)).toEqual(["race"]);
  });

  test("the answer reaches the spell", () => {
    const spells = grantedSpellsFor(elf({ spellAbilityChoices: { race: "int" } }), "2024");

    expect(spells.every((entry) => entry.ability === "int")).toBe(true);
    expect(unansweredAbilities(elf({ spellAbilityChoices: { race: "int" } }), "2024")).toEqual([]);
  });

  test("an answer the grant never offered is not taken", () => {
    // The species offers Intelligence, Wisdom or Charisma. A draft edited by
    // hand does not get to cast Faerie Fire with Strength.
    const spells = grantedSpellsFor(elf({ spellAbilityChoices: { race: "str" } }), "2024");

    expect(spells.every((entry) => entry.ability === undefined)).toBe(true);
  });

  test("nothing is asked before there is a spell to cast", () => {
    // An elf who has not chosen a lineage has nothing yet, and asking which
    // ability casts nothing is a question with no subject.
    expect(unansweredAbilities(draft(), "2024")).toEqual([]);
  });
});

/** The one source a test is about, found by the chamber that asks for it. */
const pickChamber = (
  chamber: string,
  state: Parameters<typeof spellGrantsFor>[0],
  rulesVersion: Parameters<typeof spellGrantsFor>[1],
) => spellGrantsFor(state, rulesVersion).find((source) => source.chamber === chamber);

describe("everything else that grants spells", () => {
  test("a feat grants its spells, and says which feat", () => {
    // Fey Touched: Misty Step plus one 1st-level divination or enchantment
    // spell. The named half arrives; the choice is a choice.
    const spells = grantedSpellsFor(
      draft({
        rulesVersion: "5e-2014",
        featId: slugOf("Fey Touched"),
        sourceBooks: { [`feat:${slugOf("Fey Touched")}`]: "TCE" },
      }),
      "2014",
    );

    expect(spells.map((entry) => entry.label)).toContain("misty step");
    expect(spells.every((entry) => entry.grantedBy === "Fey Touched")).toBe(true);
  });

  test("a feat that offers named lists asks which one", () => {
    // Magic Initiate's six classes, Ritual Caster's five. Same machine as a
    // 2024 species lineage, asked in the chamber that took the feat.
    const magicInitiate = pickChamber("growth", 
      draft({
        rulesVersion: "5e-2014",
        featId: slugOf("Magic Initiate"),
        sourceBooks: { [`feat:${slugOf("Magic Initiate")}`]: "PHB" },
      }),
      "2014",
    );

    expect(magicInitiate?.chamber).toBe("growth");
    expect(magicInitiate?.variants).toContain("Wizard Spells");
  });

  test("a background widens a caster's list", () => {
    const witherbloom = pickChamber("origin", 
      draft({
        rulesVersion: "5e-2014",
        backgroundId: slugOf("Witherbloom Student"),
        sourceBooks: { [`background:${slugOf("Witherbloom Student")}`]: "SCC" },
      }),
      "2014",
    );

    expect(witherbloom?.chamber).toBe("origin");
    expect(witherbloom?.entries.length).toBeGreaterThan(0);
  });

  test("a warlock's invocation is read where its list stops being the class's", () => {
    const invocation = pickChamber("gifts", 
      draft({
        rulesVersion: "5e-2014",
        classId: "warlock",
        level: 5,
        optionalFeatureIds: [slugOf("Mask of Many Faces")],
      }),
      "2014",
    );

    expect(invocation?.chamber).toBe("gifts");
    expect(invocation?.label).toBe("Mask of Many Faces");
  });
});

describe("a filter is a question, and the answer is a grant", () => {
  const initiate = (over: Record<string, unknown> = {}) =>
    draft({
      rulesVersion: "5e-2014" as const,
      featId: slugOf("Magic Initiate"),
      sourceBooks: { [`feat:${slugOf("Magic Initiate")}`]: "PHB" },
      spellVariantChoices: { [`feat:${slugOf("Magic Initiate")}`]: "Wizard Spells" },
      ...over,
    });

  /** Magic Initiate asks twice: two cantrips, and one 1st-level spell. */
  const cantripQuestion = (state: Parameters<typeof grantedSpellChoicesFor>[0]) =>
    grantedSpellChoicesFor(state, "2014").find((question) => question.count === 2);

  test("a bounded filter becomes a question with the spells that match", () => {
    const cantrips = cantripQuestion(initiate());

    expect(cantrips?.count).toBe(2);
    expect(cantrips?.chamber).toBe("growth");
    expect(cantrips?.options).toContain("Fire Bolt");
    // It is the wizard list and not every list.
    expect(cantrips?.options).not.toContain("Sacred Flame");
  });

  test("the same feat asks twice, because it grants two different things", () => {
    // Two cantrips, and one 1st-level spell cast once a day. Folding them into
    // one question would let a player take three cantrips.
    const questions = grantedSpellChoicesFor(initiate(), "2014");

    expect(questions.map((question) => question.count).sort()).toEqual([1, 2]);
    expect(new Set(questions.map((question) => question.key)).size).toBe(2);
  });

  test("an unbounded filter is not a question, because it takes everything", () => {
    // The Eldritch Knight's "every wizard cantrip" widens the pool; there is
    // nothing to answer.
    const questions = grantedSpellChoicesFor(
      draft({ rulesVersion: "5e-2014", classId: "fighter", subclassId: "eldritch-knight", level: 7 }),
      "2014",
    );

    expect(questions).toEqual([]);
  });

  test("nothing is chosen until the player chooses", () => {
    expect(grantedSpellsFor(initiate(), "2014")).toEqual([]);
    expect(unansweredSpellChoices(initiate(), "2014").length).toBeGreaterThan(0);
  });

  test("the answer arrives on the same terms the grant states", () => {
    const cantrips = cantripQuestion(initiate());
    const answered = initiate({
      grantedSpellChoices: { [cantrips!.key]: ["Fire Bolt", "Mage Hand"] },
    });

    const spells = grantedSpellsFor(answered, "2014");

    expect(spells.map((entry) => entry.label).sort()).toEqual(["fire bolt", "mage hand"]);
    expect(spells.every((entry) => entry.grantedBy === "Magic Initiate")).toBe(true);
    expect(spells.every((entry) => entry.preparation === "prepared")).toBe(true);
  });

  test("a ritual filter offers rituals, not the whole class list", () => {
    /*
     * Ritual Caster grants "a 1st-level spell that has the ritual tag". The
     * clause used to be dropped, so the feat offered every 1st-level bard
     * spell — a hundred where the rules offer ten.
     */
    const [rituals] = grantedSpellChoicesFor(
      draft({
        rulesVersion: "5e-2014",
        featId: slugOf("Ritual Caster"),
        sourceBooks: { [`feat:${slugOf("Ritual Caster")}`]: "PHB" },
        spellVariantChoices: { [`feat:${slugOf("Ritual Caster")}`]: "Bard Spells" },
      }),
      "2014",
    );

    expect(rituals?.options).toContain("Detect Magic");
    expect(rituals?.options).not.toContain("Cure Wounds");
  });

  test("the high elf's wizard cantrip is finally somewhere to choose", () => {
    const [cantrip] = grantedSpellChoicesFor(
      draft({ spellVariantChoices: { race: "High Elf" } }),
      "2024",
    );

    expect(cantrip?.chamber).toBe("species");
    expect(cantrip?.count).toBe(1);
    expect(cantrip?.options).toContain("Fire Bolt");
  });
});

describe("the warlock's Mystic Arcanum", () => {
  const warlock = (level: number, over: Record<string, unknown> = {}) =>
    draft({ rulesVersion: "5e-2014" as const, classId: "warlock", level, ...over });

  test("a warlock of 11 is asked for a 6th-level spell no slot of theirs reaches", () => {
    /*
     * Pact slots stop at fifth level, so the top four spell levels are
     * unreachable by the usual route. This is how the class reaches them, and
     * it is why the arcanum cannot ride on the ordinary picker.
     */
    const question = grantedSpellChoicesFor(warlock(11), "2014").find(
      (found) => found.label === "Arcanum Mistico",
    );

    expect(question?.count).toBe(1);
    expect(question?.chamber).toBe("class");
    expect(question?.options).toContain("Circle of Death");
    // Sixth level and only sixth: the seventh arrives at 13.
    expect(question?.options).not.toContain("Finger of Death");
  });

  test("one more at 13, 15 and 17", () => {
    const count = (level: number) =>
      grantedSpellChoicesFor(warlock(level), "2014").filter(
        (found) => found.label === "Arcanum Mistico",
      ).length;

    expect(count(10)).toBe(0);
    expect(count(11)).toBe(1);
    expect(count(13)).toBe(2);
    expect(count(17)).toBe(4);
  });

  test("the chosen spell is cast innately, once per long rest", () => {
    const [question] = grantedSpellChoicesFor(warlock(11), "2014").filter(
      (found) => found.label === "Arcanum Mistico",
    );
    const answered = warlock(11, {
      grantedSpellChoices: { [question!.key]: ["Circle of Death"] },
    });

    const arcanum = grantedSpellsFor(answered, "2014").find(
      (entry) => entry.label === "circle of death",
    );

    expect(arcanum?.method).toBe("innate");
    expect(arcanum?.uses).toEqual({ max: 1, period: "lr" });
    expect(arcanum?.grantedBy).toBe("Arcanum Mistico");
  });

  test("the level counted is the warlock's own, not the character's", () => {
    // A fighter 11 / warlock 5 has no arcanum; a warlock 11 / fighter 5 has one.
    const dip = warlock(5, {
      extraClasses: [{ classId: "fighter", subclassId: "", level: 6 }],
    });

    expect(
      grantedSpellChoicesFor(dip, "2014").filter((found) => found.label === "Arcanum Mistico"),
    ).toEqual([]);
  });

  test("no other class has one", () => {
    const sorcerer = draft({ rulesVersion: "5e-2014", classId: "sorcerer", level: 20 });

    expect(
      grantedSpellChoicesFor(sorcerer, "2014").filter((f) => f.label === "Arcanum Mistico"),
    ).toEqual([]);
  });
});

test("Iniciado Magico's 1st-level spell is cast once a day, chosen or not", () => {
  /*
   * The terms belong to the entry and not to how the spell was named. Before
   * this, a spell picked to answer a filter arrived as an ordinary spell: the
   * feat's once-a-day 1st-level spell would have cost a slot the character
   * does not have.
   */
  const state = draft({
    rulesVersion: "5e-2014",
    featId: slugOf("Magic Initiate"),
    sourceBooks: { [`feat:${slugOf("Magic Initiate")}`]: "PHB" },
    spellVariantChoices: { [`feat:${slugOf("Magic Initiate")}`]: "Wizard Spells" },
  });

  const levelled = grantedSpellChoicesFor(state, "2014").find((found) => found.count === 1);
  const answered = { ...state, grantedSpellChoices: { [levelled!.key]: ["Magic Missile"] } };

  const spell = grantedSpellsFor(answered, "2014").find((entry) => entry.label === "magic missile");

  expect(spell?.method).toBe("innate");
  expect(spell?.uses).toEqual({ max: 1, period: "day" });
  // And with Intelligence, which the feat fixes for the wizard list.
  expect(spell?.ability).toBe("int");
});
