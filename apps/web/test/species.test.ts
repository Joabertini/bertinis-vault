/**
 * What the species gives, and how a subrace adds to it.
 *
 * The two merge rules live side by side and are opposites, which is exactly
 * why they are pinned here: a subrace **replaces** its race's size, speed and
 * darkvision, and **adds** to its traits and proficiencies. Confusing them
 * either halves a species or doubles a number.
 */

import { describe, expect, test } from "vitest";

import { gearProficienciesFor } from "../src/lib/gear-proficiencies";
import { speciesProficienciesFor, speciesTraitsFor } from "../src/lib/species";

describe("species traits", () => {
  test("a dwarf reads its own traits and none of the boilerplate", () => {
    const traits = speciesTraitsFor("dwarf", "", "2014");

    expect(traits).toContain("Stonecunning");
    expect(traits).toContain("Dwarven Resilience");
    // Size, Age, Languages and Darkvision are headings every species page
    // repeats, and the sheet answers each of them somewhere better.
    expect(traits).not.toContain("Size");
    expect(traits).not.toContain("Darkvision");
    expect(traits).not.toContain("Languages");
  });

  test("a subrace adds to its race rather than replacing it", () => {
    const hillDwarf = speciesTraitsFor("dwarf", "dwarf-hill", "2014");

    // Both halves: a hill dwarf is a dwarf that is also tough.
    expect(hillDwarf).toContain("Stonecunning");
    expect(hillDwarf).toContain("Dwarven Toughness");
  });

  test("a trait printed by both is listed once", () => {
    const traits = speciesTraitsFor("elf", "elf-wood", "2014");

    expect(traits.filter((name) => name === "Elf Weapon Training").length).toBeLessThanOrEqual(1);
  });

  test("2024 dropped the dwarf's combat training and the list says so", () => {
    expect(speciesTraitsFor("dwarf", "", "2024")).not.toContain("Dwarven Combat Training");
    expect(speciesTraitsFor("dwarf", "", "2014")).toContain("Dwarven Combat Training");
  });

  test("no species yet reads as an empty list rather than throwing", () => {
    expect(speciesTraitsFor("", "", "2014")).toEqual([]);
  });
});

describe("species weapon proficiencies", () => {
  test("a dwarf brings four weapons no class gave them", () => {
    const grant = speciesProficienciesFor("dwarf", "", "2014");

    expect(grant?.weaponItems).toEqual(["battleaxe", "handaxe", "light hammer", "warhammer"]);
  });

  test("a dwarf wizard is told about the warhammer", () => {
    // The whole point: a wizard has no martial weapons, so the four the dwarf
    // brings are the only martial ones they can swing at their bonus.
    const grant = speciesProficienciesFor("dwarf", "", "2014");
    const profs = gearProficienciesFor([{ classId: "wizard" }], "2014", {
      id: "dwarf",
      ...(grant ?? { armor: [], weaponItems: [], weaponClauses: [] }),
    });

    const labels = profs.weapons.map((line) => line.label);
    expect(labels).toContain("Warhammer");
    expect(labels).toContain("Battleaxe");
    expect(profs.weapons.find((line) => line.label === "Warhammer")?.from).toEqual(["dwarf"]);
  });

  test("a dwarf fighter is not told twice", () => {
    // A fighter already has every martial weapon. Naming the battleaxe again
    // would make the list longer without making the character abler.
    const grant = speciesProficienciesFor("dwarf", "", "2014");
    const profs = gearProficienciesFor([{ classId: "fighter" }], "2014", {
      id: "dwarf",
      ...(grant ?? { armor: [], weaponItems: [], weaponClauses: [] }),
    });

    expect(profs.weapons.map((line) => line.label)).toEqual(["Armas simples", "Armas marciales"]);
    // It still reaches Foundry, where a redundant id costs nothing and a
    // missing one costs a proficiency bonus.
    expect(profs.speciesWeaponIds).toContain("battleaxe");
  });

  test("a high elf's four weapons come from the subrace, not the race", () => {
    // The elf grants a skill and no weapons — Keen Senses is Perception — so
    // the row is no longer null, and the weapons are still the subrace's.
    expect(speciesProficienciesFor("elf", "", "2014")?.weaponItems).toEqual([]);
    expect(speciesProficienciesFor("elf", "", "2014")?.skills.granted).toEqual(["Perception"]);
    expect(speciesProficienciesFor("elf", "elf-high", "2014")?.weaponItems).toEqual([
      "longsword",
      "shortsword",
      "shortbow",
      "longbow",
    ]);
  });

  test("a species that grants nothing says nothing", () => {
    expect(speciesProficienciesFor("human", "", "2014")).toBeNull();
  });
});
