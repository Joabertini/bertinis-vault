import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";
import { savingThrowChecksFor, skillChecksFor } from "../src/lib/checks";
import { expertisePlanFor } from "../src/lib/expertise";

const base = {
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  proficienciesText: "Stealth\nPerception",
};

const rogue = { ...base, classId: "rogue", subclassId: "", level: 1 };

describe("las salvaciones", () => {
  test("son las seis, siempre", () => {
    const checks = savingThrowChecksFor(buildCanonicalSnapshot(rogue));
    expect(checks.map((check) => check.ability)).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });

  test("la competencia suma el bono, y solo donde la hay", () => {
    const build = buildCanonicalSnapshot(rogue);
    const checks = savingThrowChecksFor(build);
    const dex = checks.find((check) => check.ability === "dex");
    const con = checks.find((check) => check.ability === "con");

    // El picaro salva en Destreza e Inteligencia, no en Constitucion.
    expect(dex?.proficient).toBe(true);
    expect(con?.proficient).toBe(false);
    const modifier = (score: number) => Math.floor((score - 10) / 2);
    expect(dex!.modifier - con!.modifier).toBe(
      build.derived.proficiencyBonus +
        modifier(build.abilities.final.dex) -
        modifier(build.abilities.final.con),
    );
  });
});

describe("las pericias", () => {
  test("se listan las dieciocho, no solo las que sabe", () => {
    const checks = skillChecksFor(buildCanonicalSnapshot(rogue));
    expect(checks).toHaveLength(18);
    expect(checks.map((check) => check.name)).toContain("athletics");
  });

  /*
   * Es justo la que no tiene la que el jugador no se sabe de memoria. Mostrar
   * solo lo que sabe hacer esconde las tiradas que esta por hacer mal.
   */
  test("una pericia sin competencia igual trae su numero", () => {
    const build = buildCanonicalSnapshot(rogue);
    const athletics = skillChecksFor(build).find((check) => check.name === "athletics");

    expect(athletics?.proficient).toBe(false);
    expect(athletics?.modifier).toBe(Math.floor((build.abilities.final.str - 10) / 2));
  });

  test("cada pericia va con su caracteristica", () => {
    const checks = skillChecksFor(buildCanonicalSnapshot(rogue));
    const abilityOf = (name: string) => checks.find((check) => check.name === name)?.ability;

    expect(abilityOf("stealth")).toBe("dex");
    expect(abilityOf("arcana")).toBe("int");
    expect(abilityOf("persuasion")).toBe("cha");
    expect(abilityOf("survival")).toBe("wis");
    expect(abilityOf("athletics")).toBe("str");
  });

  test("la maestria dobla el bono, no lo suma dos veces", () => {
    const [slot] = expertisePlanFor(rogue, "2014").slots;
    const build = buildCanonicalSnapshot({
      ...rogue,
      expertiseChoices: { [slot!.key]: { setIndex: 0, skills: ["Stealth", "Perception"], tools: [] } },
    });

    const stealth = skillChecksFor(build).find((check) => check.name === "stealth");
    const plain = skillChecksFor(buildCanonicalSnapshot(rogue)).find(
      (check) => check.name === "stealth",
    );

    expect(stealth?.expert).toBe(true);
    expect(stealth!.modifier - plain!.modifier).toBe(build.derived.proficiencyBonus);
  });
});
