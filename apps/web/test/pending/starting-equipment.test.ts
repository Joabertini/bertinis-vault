import { describe, expect, test } from "vitest";

import {
  buildCanonicalSnapshot,
  coerceBuilderState,
  equipmentListsFor,
  initialState,
  startingEquipmentFor,
} from "../src/lib/builder";

const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

const rogue = {
  ...base,
  classId: "rogue",
  subclassId: "",
  backgroundId: "criminal",
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
};

describe("the equipment list a character has to answer", () => {
  test("comes from the class and the background, in that order", () => {
    const lists = equipmentListsFor(rogue);

    expect(lists.map((list) => list.id)).toEqual(["class", "background"]);
    expect(lists[0]?.rows).toHaveLength(4);
    expect(lists[0]?.goldAlternative).toBe("4d4 × 10");
  });

  test("an unanswered choice grants nothing and is reported", () => {
    // The failure this replaces was quieter: the builder granted a fixed list
    // and never asked, so a rogue always got a rapier and never a shortsword.
    const resolved = startingEquipmentFor(rogue);

    expect(resolved.unanswered).toContain("class:0");
    expect(resolved.items.map((entry) => entry.name)).not.toContain("rapier");
  });

  test("answering a row puts the chosen item in the build, not the other one", () => {
    const withRapier = startingEquipmentFor({ ...rogue, equipmentChoices: { "class:0": "a" } });
    const withShortsword = startingEquipmentFor({ ...rogue, equipmentChoices: { "class:0": "b" } });

    expect(withRapier.items.map((entry) => entry.name)).toContain("rapier");
    expect(withRapier.items.map((entry) => entry.name)).not.toContain("shortsword");
    expect(withShortsword.items.map((entry) => entry.name)).toContain("shortsword");
    expect(withShortsword.items.map((entry) => entry.name)).not.toContain("rapier");
  });

  test("the granted row lands whether or not anything was answered", () => {
    const resolved = startingEquipmentFor(rogue);
    const dagger = resolved.items.find((entry) => entry.name === "dagger");

    expect(resolved.items.map((entry) => entry.name)).toContain("leather armor");
    expect(dagger?.quantity).toBe(2);
  });
});

describe("what reaches the payload", () => {
  test("a chosen item arrives with its quantity", () => {
    const snapshot = buildCanonicalSnapshot({
      ...rogue,
      equipmentChoices: { "class:0": "a", "class:1": "a", "class:2": "a" },
    });
    const normalized = snapshot.choices.normalized?.equipment ?? [];

    expect(normalized.find((entry) => entry.itemId === "rapier")?.quantity).toBe(1);
    // Two daggers is one line of two. A payload that lost the quantity would
    // hand the character one.
    expect(normalized.find((entry) => entry.itemId === "dagger")?.quantity).toBe(2);
  });

  test("an item granted twice is one line rather than two", () => {
    // A rogue may answer "shortsword" to both weapon questions and owns two.
    const snapshot = buildCanonicalSnapshot({
      ...rogue,
      equipmentChoices: { "class:0": "b", "class:1": "b" },
    });
    const shortswords = (snapshot.choices.normalized?.equipment ?? []).filter(
      (entry) => entry.itemId === "shortsword",
    );

    expect(shortswords).toHaveLength(1);
    expect(shortswords[0]?.quantity).toBe(2);
  });

  test("an item the player also picked by hand is not granted twice", () => {
    const snapshot = buildCanonicalSnapshot({
      ...rogue,
      weaponId: "rapier",
      equipmentChoices: { "class:0": "a" },
    });
    const rapiers = (snapshot.choices.normalized?.equipment ?? []).filter(
      (entry) => entry.itemId === "rapier",
    );

    expect(rapiers).toHaveLength(1);
    expect(rapiers[0]?.quantity).toBe(2);
  });

  test("taking the gold leaves the character with no equipment at all", () => {
    const snapshot = buildCanonicalSnapshot({
      ...rogue,
      takeStartingGold: true,
      equipmentChoices: { "class:0": "a" },
    });

    expect(snapshot.choices.equipment).toEqual([]);
    expect(startingEquipmentFor({ ...rogue, takeStartingGold: true }).copper).toBe(10000);
  });

  test("an item the shared catalog does not know keeps a readable name", () => {
    // "ink (1-ounce bottle)" is outside the catalog, and the fallback label is
    // the slug, which is not a name.
    const snapshot = buildCanonicalSnapshot({ ...base, backgroundId: "sage" });
    const ink = (snapshot.choices.normalized?.equipment ?? []).find((entry) =>
      entry.itemId?.startsWith("ink"),
    );

    expect(ink?.label).toBe("Ink (1-ounce bottle)");
  });
});

describe("drafts saved before equipment was a choice", () => {
  test("open with no answers rather than failing", () => {
    const draft = coerceBuilderState({ ...base, equipmentChoices: undefined, takeStartingGold: undefined });

    expect(draft.equipmentChoices).toEqual({});
    expect(draft.takeStartingGold).toBe(false);
  });

  test("keep the answers they do have and drop what is not one", () => {
    const draft = coerceBuilderState({
      ...base,
      equipmentChoices: { "class:0": "a", "class:1": 7, "class:2": "" },
      takeStartingGold: true,
    });

    expect(draft.equipmentChoices).toEqual({ "class:0": "a" });
    expect(draft.takeStartingGold).toBe(true);
  });
});
