import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "../src/lib/builder";
import { initiativeFor, passivePerceptionFor, sizeFor, speedFor } from "../src/lib/table-numbers";

const mk = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  sourceBooks: {},
  characterName: "Prueba",
  raceId: "elf",
  classId: "wizard",
  backgroundId: "acolyte",
  str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10,
  level: 1,
  rulesVersion: "5e-2014",
  ...over,
});

describe("speed and size come off the race", () => {
  test("an elf walks at 30", () => {
    expect(speedFor(mk(), "2014")).toBe(30);
  });

  test("a subrace inherits the base, because the index gives it nothing else", () => {
    // Measured: 0 of the 98 subrace rows carry a speed — they carry only their
    // ability increase. So a wood elf reads 30, not the 35 the book gives it.
    // Pinned so that the day the index grows the field, this fails and says so
    // rather than quietly staying wrong.
    expect(speedFor(mk({ subraceId: "elf-wood" }), "2014")).toBe(30);
    expect(sizeFor(mk({ subraceId: "elf-wood" }), "2014")).toBeTruthy();
  });

  test("no race yet reads as nothing rather than as a guess", () => {
    // A confident 30 for a character with no race is the failure this project
    // keeps finding. Null renders as a dash.
    expect(speedFor(mk({ raceId: "" }), "2014")).toBeNull();
    expect(sizeFor(mk({ raceId: "" }), "2014")).toBeNull();
  });
});

describe("the numbers a session asks for", () => {
  test("initiative is the Dexterity modifier", () => {
    expect(initiativeFor(buildCanonicalSnapshot(mk({ dex: 14 })))).toBe(2);
    expect(initiativeFor(buildCanonicalSnapshot(mk({ dex: 8 })))).toBe(-1);
  });

  test("initiative reads the final score, not the rolled one", () => {
    // A +2 from the species is part of the character who rolls initiative.
    const raised = mk({ dex: 14, abilityBonuses: { dex: 2 } });
    expect(initiativeFor(buildCanonicalSnapshot(raised))).toBe(3);
  });

  test("passive Perception is 10 plus Wisdom, without the skill", () => {
    expect(passivePerceptionFor(buildCanonicalSnapshot(mk({ wis: 12 })))).toBe(11);
  });

  test("and adds proficiency once the character has the skill", () => {
    const perceptive = mk({ wis: 12, proficienciesText: "Perception" });
    expect(passivePerceptionFor(buildCanonicalSnapshot(perceptive))).toBe(13);
  });
});
