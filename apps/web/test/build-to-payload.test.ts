import { RefResolver, buildToPayload, collections } from "@bertinis-vault/vetools-index";
import { expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";
import { slugOf } from "../src/lib/index-options";

const resolver = new RefResolver("2014", collections);

/**
 * The whole point of picking from the index: what the player chose has to
 * survive all the way to a reference Plutonium can import.
 */
test("a race whose name is in three books exports the one that was picked", () => {
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    raceId: slugOf("Aarakocra"),
    sourceBooks: { [`race:${slugOf("Aarakocra")}`]: "MPMM" },
  });

  const { payload, failures } = buildToPayload(snapshot, resolver);

  expect(failures.filter((entry) => entry.query.includes("aarakocra"))).toEqual([]);
  expect(payload?.race.ref.source).toBe("MPMM");
});

test("the same race without a book is reported as ambiguous rather than guessed", () => {
  const snapshot = buildCanonicalSnapshot({ ...initialState, raceId: slugOf("Aarakocra"), sourceBooks: {} });

  const { payload, failures } = buildToPayload(snapshot, resolver);

  expect(payload).toBeNull();
  expect(failures.some((entry) => entry.reason === "ambiguous")).toBe(true);
});

test("a feat chosen from the index reaches the payload", () => {
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    featId: slugOf("Alert"),
    sourceBooks: { [`feat:${slugOf("Alert")}`]: "PHB" },
  });

  const { payload } = buildToPayload(snapshot, resolver);

  expect(payload?.feats.map((entry) => entry.ref.hash)).toContain("alert_phb");
});

test("a weapon chosen from the index reaches the payload", () => {
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    weaponId: slugOf("Rapier"),
    sourceBooks: { [`item:${slugOf("Rapier")}`]: "PHB" },
  });

  const { payload } = buildToPayload(snapshot, resolver);

  expect(payload?.equipment.map((entry) => entry.ref.hash)).toContain("rapier_phb");
});

test("a 2024 build exports 2024 documents", () => {
  const snapshot = buildCanonicalSnapshot({ ...initialState, rulesVersion: "5e-2024" });
  const { payload } = buildToPayload(snapshot, new RefResolver("2024", collections));

  expect(payload?.rulesVersion).toBe("2024");
  expect(payload?.background.ref.source).toBe("XPHB");
});

test("the same picks under 2014 export 2014 documents", () => {
  const snapshot = buildCanonicalSnapshot({ ...initialState, rulesVersion: "5e-2014" });
  const { payload } = buildToPayload(snapshot, resolver);

  expect(payload?.rulesVersion).toBe("2014");
  expect(payload?.background.ref.source).toBe("PHB");
});

/*
 * Measured on two imported actors before this existed: `traits.armorProf.value`
 * and `traits.weaponProf.value` both arrived empty, so the character was
 * proficient with nothing.
 *
 * The fix travels through three packages, and only the last of them had a test.
 * This is the one that asks the question the actor asked: does what the player
 * built actually carry its proficiencies out the door?
 */
test("a character carries its weapon and armour proficiencies to the payload", () => {
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    raceId: "human",
    subraceId: "",
    classId: "fighter",
    subclassId: "",
    sourceBooks: {},
  });

  expect(snapshot.choices.armorProficiencies).toEqual(["lgt", "med", "hvy", "shl"]);
  expect(snapshot.choices.weaponProficiencies).toEqual(["sim", "mar"]);

  const { payload } = buildToPayload(snapshot, resolver);

  expect(payload?.proficiencies.armor).toEqual(["lgt", "med", "hvy", "shl"]);
  expect(payload?.proficiencies.weapons).toEqual(["sim", "mar"]);
});

test("a wizard has no armour and five named weapons, not nothing", () => {
  // The actor that prompted this was a wizard, and an empty armour set is the
  // right answer for one — which is exactly why the empty weapon set beside it
  // was easy to miss.
  const snapshot = buildCanonicalSnapshot({
    ...initialState,
    raceId: "human",
    subraceId: "",
    classId: "wizard",
    subclassId: "",
    sourceBooks: {},
  });

  expect(snapshot.choices.armorProficiencies ?? []).toEqual([]);
  expect(snapshot.choices.weaponProficiencies).toEqual([
    "dagger",
    "dart",
    "sling",
    "quarterstaff",
    "lightcrossbow",
  ]);
});

/* ------------------------------------------------- the wizard's book -- */

const wizardDraft = {
  ...initialState,
  classId: "wizard",
  cantripsText: "Mage Hand",
  spellsText: "Nv1: Shield",
  spellbookText: "Nv1: Shield\nNv1: Magic Missile",
};

test("a spell in the book but not prepared travels as unprepared", () => {
  /*
   * The two tracks have to survive to the payload or the wizard arrives in
   * Foundry with either a book they cannot cast from or a list of everything
   * ready to go — and the second is the one that used to happen.
   */
  const { payload } = buildToPayload(buildCanonicalSnapshot(wizardDraft), resolver);
  const byHash = new Map(payload?.spells.map((entry) => [entry.ref.hash, entry.preparation]));

  expect(byHash.get("shield_phb")).toBe("prepared");
  expect(byHash.get("magic%20missile_phb")).toBe("unprepared");
});

test("a spell written in both places is one spell, and it is prepared", () => {
  const { payload } = buildToPayload(buildCanonicalSnapshot(wizardDraft), resolver);
  const shields = payload?.spells.filter((entry) => entry.ref.hash === "shield_phb") ?? [];

  expect(shields).toHaveLength(1);
  expect(shields[0]?.preparation).toBe("prepared");
});

test("a cantrip carries no state, because dnd5e prepares it itself", () => {
  const { payload } = buildToPayload(buildCanonicalSnapshot(wizardDraft), resolver);
  const cantrip = payload?.spells.find((entry) => entry.ref.hash === "mage%20hand_phb");

  expect(cantrip).toBeDefined();
  expect(cantrip?.preparation).toBeUndefined();
});

test("a caster with no book has every spell prepared", () => {
  const { payload } = buildToPayload(
    buildCanonicalSnapshot({
      ...initialState,
      classId: "cleric",
      cantripsText: "",
      spellsText: "Nv1: Bless\nNv1: Cure Wounds",
      spellbookText: "",
    }),
    resolver,
  );

  expect(payload?.spells.map((entry) => entry.preparation)).toEqual(["prepared", "prepared"]);
});

/* --------------------------------------------- what a species grants -- */

test("a species spell reaches the payload without anyone typing it", () => {
  /*
   * 222 entities outside the subclasses grant spells and not one of them used
   * to reach a character. A tiefling arrived without Thaumaturgy.
   */
  const { payload } = buildToPayload(
    buildCanonicalSnapshot({
      ...initialState,
      raceId: slugOf("Tiefling"),
      sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
      classId: "fighter",
      level: 5,
      cantripsText: "",
      spellsText: "",
    }),
    resolver,
  );

  const byHash = new Map(payload?.spells.map((entry) => [entry.ref.hash, entry]));
  const thaumaturgy = byHash.get("thaumaturgy_phb");

  expect(thaumaturgy).toBeDefined();
  expect(thaumaturgy?.grantedBy).toBe("Tiefling");
});

test("a spell granted once a day is cast innately, and says how often", () => {
  const { payload } = buildToPayload(
    buildCanonicalSnapshot({
      ...initialState,
      raceId: slugOf("Tiefling"),
      sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
      classId: "fighter",
      level: 5,
      cantripsText: "",
      spellsText: "",
    }),
    resolver,
  );

  // Hellish Rebuke, once a day at level 3. Importing it as an ordinary spell
  // would charge a fighter a level 1 slot for magic the species hands over.
  const rebuke = payload?.spells.find((entry) => entry.ref.hash === "hellish%20rebuke_phb");

  expect(rebuke?.method).toBe("innate");
  expect(rebuke?.uses).toEqual({ max: 1, period: "day" });
});

test("a spell both granted and written is one spell", () => {
  const { payload } = buildToPayload(
    buildCanonicalSnapshot({
      ...initialState,
      raceId: slugOf("Tiefling"),
      sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
      classId: "sorcerer",
      level: 5,
      cantripsText: "Thaumaturgy",
      spellsText: "",
    }),
    resolver,
  );

  const found = payload?.spells.filter((entry) => entry.ref.hash === "thaumaturgy_phb") ?? [];

  expect(found).toHaveLength(1);
});

test("a species spell carries the ability it is cast with", () => {
  /*
   * dnd5e keeps this on the spell and prefers it over the class's, which is
   * the only thing that gives a fighter's species cantrip a save DC: a fighter
   * has no spellcasting ability to fall back on.
   */
  const { payload } = buildToPayload(
    buildCanonicalSnapshot({
      ...initialState,
      raceId: slugOf("Tiefling"),
      sourceBooks: { [`race:${slugOf("Tiefling")}`]: "PHB" },
      classId: "fighter",
      level: 5,
      cantripsText: "",
      spellsText: "",
    }),
    resolver,
  );

  const thaumaturgy = payload?.spells.find((entry) => entry.ref.hash === "thaumaturgy_phb");

  expect(thaumaturgy?.ability).toBe("cha");
});
