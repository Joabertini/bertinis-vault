import { describe, expect, test } from "vitest";

import { initialState, type BuilderState } from "../src/lib/builder";
import { talentPools, talentsSatisfied, unmetTalents } from "../src/lib/optional-features";

const build = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  optionalFeatureIds: [],
  rulesVersion: "5e-2014",
  raceId: "human",
  backgroundId: "acolyte",
  ...over,
});

const pools = (over: Partial<BuilderState>, className: string, subclassName = "") =>
  talentPools(build(over), "2014", className, subclassName);

const named = (list: ReturnType<typeof pools>, needle: string) =>
  list.find((pool) => pool.name.toLowerCase().includes(needle));

describe("what a class asks the player to choose", () => {
  test("a warlock is owed invocations, and the count grows with level", () => {
    const at2 = named(pools({ classId: "warlock", level: 2 }, "Warlock"), "invocation");
    const at9 = named(pools({ classId: "warlock", level: 9 }, "Warlock"), "invocation");

    expect(at2?.count).toBeGreaterThan(0);
    expect(at9!.count).toBeGreaterThan(at2!.count);
  });

  test("a progression that has not started yet asks nothing", () => {
    // Metamagic arrives at 3. A "choose 0" section reads as a bug, so the
    // pool is dropped rather than shown empty.
    expect(named(pools({ classId: "sorcerer", level: 2 }, "Sorcerer"), "metamagic")).toBeUndefined();
    expect(named(pools({ classId: "sorcerer", level: 3 }, "Sorcerer"), "metamagic")?.count).toBe(2);
  });

  test("a subclass asks its own questions, not only the class's", () => {
    // The fighting style is the fighter's; the manoeuvres are the battle
    // master's. Reading only the class offers a battle master nothing.
    const classOnly = pools({ classId: "fighter", level: 7 }, "Fighter");
    const withSubclass = pools({ classId: "fighter", level: 7, subclassId: "battle-master" }, "Fighter", "Battle Master");

    expect(named(classOnly, "manoeuvre") ?? named(classOnly, "maneuver")).toBeUndefined();
    expect(named(withSubclass, "manoeuvre") ?? named(withSubclass, "maneuver")).toBeDefined();
  });

  test("a class that asks nothing is not asked", () => {
    expect(pools({ classId: "wizard", level: 10 }, "Wizard")).toEqual([]);
  });

  test("no class at all asks nothing", () => {
    expect(pools({ classId: "", level: 5 }, "")).toEqual([]);
  });
});

describe("whether an option is legal for this character", () => {
  const warlock5 = () => pools({ classId: "warlock", level: 5 }, "Warlock");

  test("an invocation that wants a pact boon waits for the boon", () => {
    const invocations = named(warlock5(), "invocation")!;
    const gated = invocations.options.filter((option) => !option.eligible);

    expect(gated.length).toBeGreaterThan(0);
    // Ineligible options are shown, not hidden: a player who knows the
    // invocation exists and cannot find it assumes the app is broken.
    expect(gated[0]!.blockedBy).toBeTruthy();
  });

  test("a prose prerequisite is shown rather than checked", () => {
    // The artificer is the subject because the prose lives on its infusions:
    // "A suit of armor (requires attunement)" is a sentence about a character's
    // belongings, which no build field answers. Invocations have none.
    const infusions = talentPools(
      build({ classId: "artificer", level: 6 }),
      "2014",
      "Artificer",
      "",
    ).flatMap((pool) => pool.options);

    // Carried as notes for the player to judge, not turned into a refusal.
    expect(infusions.some((option) => option.notes.length > 0)).toBe(true);
  });
});

describe("what the player has picked against it", () => {
  test("a pool is satisfied once it is filled, and not before", () => {
    const list = pools({ classId: "sorcerer", level: 3 }, "Sorcerer");
    const metamagic = named(list, "metamagic")!;

    expect(talentsSatisfied(list, [])).toBe(false);
    expect(talentsSatisfied(list, metamagic.options.slice(0, 2).map((option) => option.id))).toBe(true);
  });

  test("a talent that stopped being legal is reported rather than removed", () => {
    const list = pools({ classId: "warlock", level: 5 }, "Warlock");
    const blocked = named(list, "invocation")!.options.find((option) => !option.eligible)!;

    const problems = unmetTalents(list, [blocked.id]);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.id).toBe(blocked.id);
    expect(problems[0]!.reason).toBeTruthy();
  });

  test("a legal build reports nothing", () => {
    const list = pools({ classId: "warlock", level: 5 }, "Warlock");
    const fine = named(list, "invocation")!.options.filter((option) => option.eligible).slice(0, 2);

    expect(unmetTalents(list, fine.map((option) => option.id))).toEqual([]);
  });
});
