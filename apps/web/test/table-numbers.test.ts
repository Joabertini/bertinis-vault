import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState, type BuilderState } from "../src/lib/builder";
import {
  foundrySizeFor,
  initiativeFor,
  passivePerceptionFor,
  sensesFor,
  sizeFor,
  sizeLabelFor,
  sizeOptionsFor,
  speedFor,
} from "../src/lib/table-numbers";

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

  test("a subrace that walks faster walks faster", () => {
    // The wood elf's 35 is the whole reason people play one, and it read 30
    // until the index carried the subrace's own speed.
    expect(speedFor(mk({ subraceId: "elf-wood" }), "2014")).toBe(35);
    expect(sizeFor(mk({ subraceId: "elf-wood" }), "2014")).toBeTruthy();
  });

  test("a subrace that says nothing about speed keeps its race's", () => {
    // The hill dwarf prints no speed because it walks at the dwarf's 25. Read
    // as an answer rather than as a silence, that null took the speed away.
    expect(speedFor(mk({ raceId: "dwarf", subraceId: "dwarf-hill" }), "2014")).toBe(25);
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

describe("el tamano", () => {
  const at = (raceId: string, subraceId = "") => ({
    ...initialState,
    abilityBonuses: {},
    levelChoices: {},
    raceId,
    subraceId,
  });

  /*
   * 34 de las 124 especies de 2014 son Pequenas y todas exportaban como
   * Medianas. No es cosmetico: el tamano fija la casilla que ocupas, por donde
   * pasas, y en 2024 si un arma Pesada te cuesta desventaja.
   */
  test("un gnomo es pequeno y un humano mediano", () => {
    expect(foundrySizeFor(at("gnome"), "2014")).toBe("sm");
    expect(foundrySizeFor(at("human"), "2014")).toBe("med");
  });

  test("sin especie elegida no hay tamano que afirmar", () => {
    expect(foundrySizeFor(at(""), "2014")).toBeNull();
  });

  test("se dice en castellano en la ficha", () => {
    expect(sizeLabelFor(at("halfling"), "2014")).toBe("Pequeno");
    expect(sizeLabelFor(at("human"), "2014")).toBe("Mediano");
  });

  test("llega al payload", () => {
    const snapshot = buildCanonicalSnapshot({ ...at("gnome"), classId: "wizard", level: 1 });
    expect(snapshot.ancestry.size).toBe("sm");
  });
});

/*
 * Treinta especies imprimen dos tamanos y el libro se lo pregunta al jugador.
 * El indice guardaba solo la primera letra, asi que las treinta salian
 * Pequenas: un humano de 2024 llegaba a la mesa en una casilla Pequena y
 * cargando la mitad del peso.
 */
describe("las especies que ofrecen dos tamanos preguntan", () => {
  const at = (raceId: string, over: Partial<BuilderState> = {}): BuilderState => ({
    ...initialState,
    abilityBonuses: {},
    levelChoices: {},
    sourceBooks: {},
    rulesVersion: "5e-2024",
    raceId,
    subraceId: "",
    sizeChoice: "",
    ...over,
  });

  test("el humano de 2024 ofrece Pequeno y Mediano; el enano de 2014 no ofrece nada", () => {
    expect(sizeOptionsFor(at("human"), "2024")).toEqual(["S", "M"]);
    expect(sizeOptionsFor(at("dwarf", { rulesVersion: "5e-2014" }), "2014")).toEqual(["M"]);
  });

  test("sin respuesta no se afirma un tamano", () => {
    // Lo contrario — quedarse con la primera letra — es exactamente el bug.
    expect(sizeFor(at("human"), "2024")).toBeNull();
    expect(foundrySizeFor(at("human"), "2024")).toBeNull();
  });

  test("la respuesta del jugador es la que viaja", () => {
    expect(foundrySizeFor(at("human", { sizeChoice: "S" }), "2024")).toBe("sm");
    expect(foundrySizeFor(at("human", { sizeChoice: "M" }), "2024")).toBe("med");
  });

  test("una especie que ofrece uno contesta sola", () => {
    // Nadie tiene que responder una pregunta que no se hizo.
    expect(foundrySizeFor(at("goliath", { rulesVersion: "5e-2014" }), "2014")).toBe("med");
  });

  test("una respuesta que la nueva especie no ofrece no se hereda", () => {
    // Un jugador que eligio Pequeno como humano y despues se rehizo enano no
    // se lleva la respuesta puesta: el enano nunca pregunto.
    const dwarf = at("dwarf", { rulesVersion: "5e-2014", sizeChoice: "S" });
    expect(foundrySizeFor(dwarf, "2014")).toBe("med");
  });

  test("llega al payload con la letra elegida", () => {
    const snapshot = buildCanonicalSnapshot(
      at("human", { sizeChoice: "S", classId: "wizard", level: 1, backgroundId: "acolyte" }),
    );
    expect(snapshot.ancestry.size).toBe("sm");
  });
});

describe("what the race lets you see and how else you move", () => {
  test("a drow sees 120 feet where an elf sees 60", () => {
    // The subrace overrides rather than adds. Reading only the race left every
    // drow at the elf's 60 — half the distance, in the dark, on a character
    // whose whole point is the dark.
    expect(sensesFor(mk(), "2014")?.darkvision).toBe(60);
    expect(sensesFor(mk({ subraceId: "elf-drow" }), "2014")?.darkvision).toBe(120);
  });

  test("a human sees nothing special, and says so rather than showing a zero", () => {
    expect(sensesFor(mk({ raceId: "human", subraceId: "" }), "2014")?.darkvision).toBeNull();
  });

  test("an aarakocra flies", () => {
    const senses = sensesFor(mk({ raceId: "aarakocra", subraceId: "" }), "2014");

    expect(senses?.otherSpeeds.some((entry) => entry.mode === "fly")).toBe(true);
  });

  test("a sea elf swims, and gets it from its subrace", () => {
    const senses = sensesFor(mk({ subraceId: "elf-sea" }), "2014");

    expect(senses?.otherSpeeds).toContainEqual({ mode: "swim", feet: 30 });
  });

  test("walking is not listed as an extra way to move", () => {
    const senses = sensesFor(mk(), "2014");

    expect(senses?.otherSpeeds.map((entry) => entry.mode)).not.toContain("walk");
  });

  test("no race yet reads as nothing", () => {
    expect(sensesFor(mk({ raceId: "" }), "2014")).toBeNull();
  });
});
