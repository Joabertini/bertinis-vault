import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";
import { expertisePlanFor } from "../src/lib/expertise";
import { passivePerceptionFor } from "../src/lib/table-numbers";

const base = {
  ...initialState,
  abilityBonuses: {},
  levelChoices: {},
  proficienciesText: "Stealth\nPerception\nArcana\nThieves' Tools",
};

const rogue = (level: number, rulesVersion: "5e-2014" | "5e-2024" = "5e-2014") => ({
  ...base,
  rulesVersion,
  classId: "rogue",
  subclassId: "",
  level,
});

describe("que maestrias ha ganado el personaje", () => {
  test("un mago no gana ninguna", () => {
    expect(expertisePlanFor({ ...base, classId: "wizard", level: 12 }, "2014").slots).toEqual([]);
  });

  test("el picaro gana una a nivel 1 y otra a nivel 6", () => {
    expect(expertisePlanFor(rogue(1), "2014").slots).toHaveLength(1);
    expect(expertisePlanFor(rogue(6), "2014").slots).toHaveLength(2);
  });

  /*
   * Las dos se llaman "Expertise". Una clave por nombre las juntaria en una
   * sola respuesta y gastaria las elecciones de nivel 6 en la pregunta de
   * nivel 1.
   */
  test("las dos concesiones del picaro tienen claves distintas", () => {
    const [first, second] = expertisePlanFor(rogue(6), "2014").slots;
    expect(first?.key).not.toBe(second?.key);
  });

  test("el pozo es lo que el personaje ya sabe hacer", () => {
    const plan = expertisePlanFor(rogue(1), "2014");
    expect(plan.proficientSkills).toContain("Stealth");
    expect(plan.proficientSkills).not.toContain("Athletics");
    expect(plan.proficientTools).toContain("Thieves' Tools");
  });
});

describe("que problemas ve el jugador", () => {
  test("sin responder, la concesion lo dice", () => {
    const [slot] = expertisePlanFor(rogue(1), "2014").slots;
    expect(slot?.problems.map((problem) => problem.kind)).toEqual(["unchosen"]);
  });

  test("doblar algo que no sabes hacer se reporta", () => {
    const [slot] = expertisePlanFor(rogue(1), "2014").slots;
    const plan = expertisePlanFor(
      { ...rogue(1), expertiseChoices: { [slot!.key]: { setIndex: 0, skills: ["Stealth", "Athletics"], tools: [] } } },
      "2014",
    );

    expect(plan.slots[0]?.problems).toContainEqual({
      kind: "not-proficient",
      of: "skill",
      id: "Athletics",
    });
  });

  /*
   * La razon por la que el orden importa: la concesion de nivel 6 se revisa
   * contra lo que la de nivel 1 ya tomo. Doblar dos veces no suma, y un
   * constructor que lo permitiera le gastaria en silencio una eleccion que el
   * jugador creia haber hecho.
   */
  test("la segunda concesion no puede repetir lo que tomo la primera", () => {
    const slots = expertisePlanFor(rogue(6), "2014").slots;
    const [first, second] = slots;

    const plan = expertisePlanFor(
      {
        ...rogue(6),
        expertiseChoices: {
          [first!.key]: { setIndex: 0, skills: ["Stealth", "Perception"], tools: [] },
          [second!.key]: { setIndex: 0, skills: ["Stealth", "Arcana"], tools: [] },
        },
      },
      "2014",
    );

    expect(plan.slots[1]?.problems).toContainEqual({
      kind: "duplicate",
      of: "skill",
      id: "Stealth",
    });
  });

  test("una respuesta completa y legal no reporta nada", () => {
    const [slot] = expertisePlanFor(rogue(1), "2014").slots;
    const plan = expertisePlanFor(
      { ...rogue(1), expertiseChoices: { [slot!.key]: { setIndex: 0, skills: ["Stealth", "Perception"], tools: [] } } },
      "2014",
    );

    expect(plan.slots[0]?.problems).toEqual([]);
  });
});

describe("lo que llega al payload y a la ficha", () => {
  const answered = () => {
    const [slot] = expertisePlanFor(rogue(1), "2014").slots;
    return {
      ...rogue(1),
      expertiseChoices: { [slot!.key]: { setIndex: 0, skills: ["Stealth", "Perception"], tools: [] } },
    };
  };

  /*
   * La maestria viaja AL LADO de la competencia que dobla, nunca en su lugar:
   * una pericia escrita solo como maestria es una pericia en la que el
   * personaje no queda registrado como competente.
   */
  test("la maestria no reemplaza a la competencia", () => {
    const entries = buildCanonicalSnapshot(answered()).choices.normalized!.proficiencies;

    expect(entries).toContainEqual({ kind: "skill", label: "Stealth" });
    expect(entries).toContainEqual({ kind: "expertise", label: "Stealth" });
  });

  test("sin responder no viaja ninguna maestria", () => {
    const entries = buildCanonicalSnapshot(rogue(1)).choices.normalized!.proficiencies;
    expect(entries.some((entry) => entry.kind === "expertise")).toBe(false);
  });

  /*
   * La percepcion pasiva es el numero que la mesa juega sin tirar: el DM lo
   * compara contra el Sigilo de lo que se esconde. Leerlo cinco bajo hace al
   * personaje peor en lo que gasto su eleccion mas rara.
   */
  test("la percepcion pasiva dobla el bono, no lo suma una vez", () => {
    const doubled = passivePerceptionFor(buildCanonicalSnapshot(answered()));
    const plain = passivePerceptionFor(buildCanonicalSnapshot(rogue(1)));

    expect(doubled - plain).toBe(buildCanonicalSnapshot(rogue(1)).derived.proficiencyBonus);
  });
});
