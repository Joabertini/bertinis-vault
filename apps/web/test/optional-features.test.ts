import { describe, expect, test } from "vitest";

import {
  initialState,
  optionalFeatureContextFor,
  optionalFeatureGrantersFor,
  optionalFeaturePrerequisitesFor,
  optionalFeatureSlotsFor,
  unmetOptionalFeaturesFor,
} from "../src/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {}, optionalFeatureIds: [] };

const warlock = (over = {}) => ({
  ...base,
  classId: "warlock",
  subclassId: "",
  level: 5,
  extraClasses: [],
  ...over,
});

const named = (slots: ReturnType<typeof optionalFeatureSlotsFor>) =>
  slots.map((slot) => `${slot.name}:${slot.count}`);

describe("what a class asks the player to choose", () => {
  test("a warlock is owed invocations, and the count grows with level", () => {
    // All of this was modelled and none of it was ever asked for: the build
    // carried a list nothing filled and nothing checked.
    const early = optionalFeatureSlotsFor(warlock({ level: 2 }));
    const later = optionalFeatureSlotsFor(warlock({ level: 12 }));

    const invocations = (slots: ReturnType<typeof optionalFeatureSlotsFor>) =>
      slots.find((slot) => /invocation/i.test(slot.name))?.count ?? 0;

    expect(invocations(early)).toBeGreaterThan(0);
    expect(invocations(later)).toBeGreaterThan(invocations(early));
  });

  test("a progression that has not started yet asks nothing", () => {
    // A sorcerer has no metamagic before level 3, which is different from
    // having a quota of zero.
    const early = optionalFeatureSlotsFor({ ...warlock(), classId: "sorcerer", level: 2 });

    expect(early.some((slot) => /metamagic/i.test(slot.name))).toBe(false);
    expect(
      optionalFeatureSlotsFor({ ...warlock(), classId: "sorcerer", level: 3 }).some((slot) =>
        /metamagic/i.test(slot.name),
      ),
    ).toBe(true);
  });

  test("a subclass asks its own questions, not only the class's", () => {
    // A battle master's maneuvers are the subclass's. Reading only the class
    // would offer a battle master nothing.
    const granters = optionalFeatureGrantersFor({
      ...warlock(),
      classId: "fighter",
      subclassId: "battle-master",
      level: 3,
    });

    expect(granters.map((entry) => entry.name)).toContain("Battle Master");

    const slots = optionalFeatureSlotsFor({
      ...warlock(),
      classId: "fighter",
      subclassId: "battle-master",
      level: 3,
    });
    expect(named(slots).some((entry) => /maneuver/i.test(entry))).toBe(true);
  });

  test("a class that asks nothing is not asked", () => {
    expect(optionalFeatureSlotsFor({ ...warlock(), classId: "barbarian", level: 5 })).toEqual([]);
  });
});

describe("what the player has picked against it", () => {
  test("a pick is counted against the pool it belongs to", () => {
    const picked = warlock({ optionalFeatureIds: ["agonizing-blast"] });
    const slot = optionalFeatureSlotsFor(picked).find((entry) => /invocation/i.test(entry.name));

    expect(slot?.taken.map((entry) => entry.name)).toEqual(["Agonizing Blast"]);
    expect(slot?.remaining).toBe((slot?.count ?? 0) - 1);
  });

  test("more picks than the level allows go negative rather than being trimmed", () => {
    // That is what a downgraded level looks like. The picks stay and the
    // shortfall is reported, because deleting a player's choices is worse.
    const overloaded = warlock({
      level: 2,
      optionalFeatureIds: ["agonizing-blast", "armor-of-shadows", "beast-speech", "beguiling-influence"],
    });
    const slot = optionalFeatureSlotsFor(overloaded).find((entry) => /invocation/i.test(entry.name));

    expect(slot?.remaining).toBeLessThan(0);
    expect(overloaded.optionalFeatureIds).toHaveLength(4);
  });
});

describe("whether an option is legal for this character", () => {
  test("an invocation that wants a warlock level is checked against that level", () => {
    // Against a multiclass build this is the level in *that* class, not the
    // character's total.
    const low = warlock({ level: 4 });
    const high = warlock({ level: 12 });

    expect(optionalFeaturePrerequisitesFor(low, "lifedrinker").unmet.some(
      (entry) => entry.kind === "level",
    )).toBe(true);
    expect(optionalFeaturePrerequisitesFor(high, "lifedrinker").unmet.some(
      (entry) => entry.kind === "level",
    )).toBe(false);

    // Lifedrinker asks for two things at once — Warlock 12 and Pact of the
    // Blade — and reaching the level satisfies only one of them.
    const armed = warlock({ level: 12, optionalFeatureIds: ["pact-of-the-blade"] });
    expect(optionalFeaturePrerequisitesFor(armed, "lifedrinker").unmet).toEqual([]);
  });

  test("an invocation that wants a pact boon waits for the boon", () => {
    const without = optionalFeaturePrerequisitesFor(warlock({ level: 5 }), "book-of-ancient-secrets");
    expect(without.unmet.some((entry) => entry.kind === "pact")).toBe(true);

    const withTome = warlock({ level: 5, optionalFeatureIds: ["pact-of-the-tome"] });
    expect(
      optionalFeaturePrerequisitesFor(withTome, "book-of-ancient-secrets").unmet.some(
        (entry) => entry.kind === "pact",
      ),
    ).toBe(false);
  });

  test("an invocation that wants a spell is checked against the spells known", () => {
    const without = optionalFeaturePrerequisitesFor(warlock(), "agonizing-blast");
    expect(without.unmet.some((entry) => entry.kind === "spell")).toBe(true);

    const withBlast = warlock({ cantripsText: "Eldritch Blast" });
    expect(
      optionalFeaturePrerequisitesFor(withBlast, "agonizing-blast").unmet.some(
        (entry) => entry.kind === "spell",
      ),
    ).toBe(false);
  });

  test("a prose prerequisite is shown rather than checked", () => {
    // Checking it would mean guessing, and a guess that hides a legal option
    // is worse than showing one the table has to rule on.
    const context = optionalFeatureContextFor(warlock());

    expect(context.characterLevel).toBe(5);
    expect(Object.keys(context.classLevels)).toContain("Warlock|PHB");
  });

  test("an option the index has never heard of asks nothing", () => {
    expect(optionalFeaturePrerequisitesFor(warlock(), "not-a-feature")).toEqual({
      unmet: [],
      text: [],
    });
  });

  test("an illegal option already on the build is reported rather than removed", () => {
    const illegal = warlock({ level: 2, optionalFeatureIds: ["lifedrinker"] });

    expect(unmetOptionalFeaturesFor(illegal).map((entry) => entry.optionId)).toEqual(["lifedrinker"]);
    expect(illegal.optionalFeatureIds).toEqual(["lifedrinker"]);
  });

  test("a legal build reports nothing", () => {
    const legal = warlock({ level: 12, cantripsText: "Eldritch Blast", optionalFeatureIds: ["agonizing-blast"] });

    expect(unmetOptionalFeaturesFor(legal)).toEqual([]);
  });
});
