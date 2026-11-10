import { describe, expect, test } from "vitest";

import {
  grantedOptions,
  kitItemIds,
  parseKitSignature,
  rekitBag,
  startingKitFor,
  takenOptions,
} from "../src/lib/starting-kit";

const count = (bag: string[], line: string) => bag.filter((entry) => entry === line).length;

describe("rekitBag: changing the kit replaces it instead of stacking it", () => {
  test("picking a background after the class does not grant the class kit twice", () => {
    // The Forge applies the kit when the class is picked and again when the
    // background is. A 2014 rogue used to come out of that with two of every
    // granted line.
    const rogueOnly = startingKitFor("rogue", "", "2014");
    const rogueAcolyte = startingKitFor("rogue", "acolyte", "2014");
    const classLines = grantedOptions(rogueOnly).flatMap(kitItemIds);
    expect(classLines.length).toBeGreaterThan(0);

    const afterClass = rekitBag([], [], {}, rogueOnly);
    const afterBackground = rekitBag(afterClass, rogueOnly, {}, rogueAcolyte);

    for (const line of classLines) {
      expect(count(afterBackground, line)).toBe(count(classLines, line));
    }
  });

  test("a fighter remade as a wizard leaves the fighter's answered kit behind", () => {
    const fighter = startingKitFor("fighter", "", "2014");
    const choices = Object.fromEntries(
      fighter.filter((row) => !row.granted).map((row) => [row.key, row.options[0]!.key]),
    );
    const fighterLines = takenOptions(fighter, choices).flatMap(kitItemIds);
    expect(fighterLines.length).toBeGreaterThan(0);

    const wizard = startingKitFor("wizard", "", "2014");
    const bag = rekitBag(fighterLines, fighter, choices, wizard);

    for (const line of fighterLines) {
      if (!grantedOptions(wizard).flatMap(kitItemIds).includes(line)) {
        expect(bag).not.toContain(line);
      }
    }
    for (const line of grantedOptions(wizard).flatMap(kitItemIds)) {
      expect(bag).toContain(line);
    }
  });

  test("what the player added by hand survives, even a copy of a kit item", () => {
    const rogue = startingKitFor("rogue", "", "2014");
    const granted = grantedOptions(rogue).flatMap(kitItemIds);
    const bag = rekitBag([...granted, granted[0]!, "rope-hempen-50-feet"], rogue, {}, []);

    expect(bag).toEqual([granted[0], "rope-hempen-50-feet"]);
  });
});

describe("parseKitSignature", () => {
  test("reads back what the Forge stores", () => {
    expect(parseKitSignature("fighter|acolyte|5e-2024")).toEqual({
      classId: "fighter",
      backgroundId: "acolyte",
      rulesVersion: "2024",
    });
    expect(parseKitSignature("rogue||5e-2014")).toEqual({
      classId: "rogue",
      backgroundId: "",
      rulesVersion: "2014",
    });
  });

  test("a draft that never applied a kit has nothing to take out", () => {
    expect(parseKitSignature("")).toBeNull();
    expect(parseKitSignature("||5e-2014")).toBeNull();
  });
});
