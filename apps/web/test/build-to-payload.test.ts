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
