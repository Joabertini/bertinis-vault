/**
 * Which magic items the character is attuned to.
 *
 * The bag marked an item as requiring attunement and then nothing asked, so
 * every magic item reached Foundry with the box unticked — which for most of
 * them means it does nothing at all.
 */

import { describe, expect, it } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "@/lib/builder";
import { attunableItemsFor, attunementStateFor } from "@/lib/attunement";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  weaponId: "",
  armorId: "",
  extraEquipmentText: "",
  attunedItemIds: [],
  ...over,
});

describe("what can be attuned to", () => {
  it("offers only what asks for attunement", () => {
    // Rations ask for none, and a panel that listed it would bury the one item
    // the question is about.
    const state = draft({ extraEquipmentText: "cloak-of-protection\nrations-1-day" });

    expect(attunableItemsFor(state, "2014").map((entry) => entry.id)).toEqual([
      "cloak-of-protection",
    ]);
  });

  it("looks at the weapon and the armour, not only the bag", () => {
    // A +1 longsword is a weapon slot and a Cloak of Elvenkind is armour.
    const state = draft({ armorId: "cloak-of-protection" });

    expect(attunableItemsFor(state, "2014").map((entry) => entry.id)).toEqual([
      "cloak-of-protection",
    ]);
  });

  it("leaves a hand-typed line out rather than offering it", () => {
    // It has no attunement flag to read, and offering every note in the bag as
    // a magic item would bury the two that are.
    const state = draft({ extraEquipmentText: "la carta de mi hermana" });

    expect(attunableItemsFor(state, "2014")).toEqual([]);
  });
});

describe("the three slots", () => {
  it("counts what the player marked", () => {
    const state = draft({
      extraEquipmentText: "cloak-of-protection\nring-of-protection",
      attunedItemIds: ["ring-of-protection"],
    });

    const result = attunementStateFor(state, "2014");

    expect(result.used).toBe(1);
    expect(result.attuned.map((entry) => entry.id)).toEqual(["ring-of-protection"]);
    expect(result.over).toBe(0);
  });

  it("gives the slot back when the item leaves the bag", () => {
    const state = draft({ extraEquipmentText: "", attunedItemIds: ["ring-of-protection"] });

    expect(attunementStateFor(state, "2014").used).toBe(0);
  });

  it("names a fourth rather than refusing it", () => {
    const items = [
      "cloak-of-protection",
      "ring-of-protection",
      "belt-of-hill-giant-strength",
      "amulet-of-health",
    ];
    const state = draft({ extraEquipmentText: items.join("\n"), attunedItemIds: items });

    const result = attunementStateFor(state, "2014");

    expect(result.used).toBe(4);
    expect(result.over).toBe(1);
  });
});

describe("what crosses to Foundry", () => {
  it("marks the attuned item and leaves the rest alone", () => {
    // dnd5e keeps it per item as `system.attuned`. An unattuned Cloak of
    // Protection is a cloak that grants nothing.
    const snapshot = buildCanonicalSnapshot(
      draft({
        extraEquipmentText: "cloak-of-protection\nrations-1-day",
        attunedItemIds: ["cloak-of-protection"],
      }),
    );

    const equipment = snapshot.choices.normalized!.equipment;
    const cloak = equipment.find((entry) => entry.label.toLowerCase().includes("cloak"));
    const rations = equipment.find((entry) => entry.label.toLowerCase().includes("ration"));

    expect(cloak?.attuned).toBe(true);
    expect(rations?.attuned).toBeUndefined();
  });

  it("carries the player's answer as well as the marks", () => {
    const snapshot = buildCanonicalSnapshot(
      draft({ extraEquipmentText: "cloak-of-protection", attunedItemIds: ["cloak-of-protection"] }),
    );

    expect(snapshot.choices.attunedItems).toEqual(["cloak-of-protection"]);
  });

  it("says nothing about attunement for a character with no magic items", () => {
    const snapshot = buildCanonicalSnapshot(draft({ extraEquipmentText: "rations-1-day" }));

    expect(snapshot.choices.attunedItems).toBeUndefined();
    expect(snapshot.choices.normalized!.equipment.every((entry) => !entry.attuned)).toBe(true);
  });
});
