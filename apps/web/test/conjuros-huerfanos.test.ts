/**
 * Lo que una clase que se fue ofrecia, se va con ella.
 *
 * Las listas son texto y los selectores muestran solo lo que una clase
 * ofrece, asi que un conjuro cuya clase se fue quedaba en el texto: invisible
 * en la pagina y adentro de la exportacion.
 */

import { describe, expect, test } from "vitest";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import { spellPlansFor, strayChoices } from "../src/lib/spells";

const snapshot = {
  derived: { spellcasting: { ability: "int", slots: { "1": 4, "2": 3, "3": 2 } } },
  abilities: { final: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 } },
} as unknown as CharacterBuild;

const label = (classId: string) => ({
  label: classId.charAt(0).toUpperCase() + classId.slice(1),
  source: "PHB",
});

const fighter = (level: number) => ({ classId: "fighter", level, casterProgression: null });
const wizard = (level: number) => ({
  classId: "wizard",
  level,
  casterProgression: "full",
  spellcastingAbility: "int",
});

const plansFor = (entries: unknown[], spellbook: string[]) =>
  spellPlansFor({ entries: entries as never, labelFor: label, rulesVersion: "2014", snapshot, spellbook });

const chosen = {
  cantrips: ["Fire Bolt"],
  spells: ["Nv1: Shield"],
  book: ["Nv1: Shield", "Nv1: Magic Missile"],
};

describe("strayChoices", () => {
  test("con el mago todavia ahi no sobra nada", () => {
    const plans = plansFor([fighter(3), wizard(2)], chosen.book);
    expect(strayChoices(plans, chosen)).toEqual({ cantrips: [], spells: [], book: [] });
  });

  test("sin el mago, todo lo del mago sobra", () => {
    const plans = plansFor([fighter(3)], chosen.book);
    expect(strayChoices(plans, chosen)).toEqual(chosen);
  });

  test("bajar de nivel suelta lo que ese nivel ya no alcanza, y nada mas", () => {
    const book = ["Nv1: Shield", "Nv3: Fireball"];
    const picks = { cantrips: ["Fire Bolt"], spells: ["Nv1: Shield", "Nv3: Fireball"], book };

    expect(strayChoices(plansFor([wizard(5)], book), picks)).toEqual({
      cantrips: [],
      spells: [],
      book: [],
    });
    // Un mago 3 escribe hasta nivel 2: la Bola de Fuego sale del libro, y con
    // ella de los preparados.
    expect(strayChoices(plansFor([wizard(3)], book), picks)).toEqual({
      cantrips: [],
      spells: ["Nv3: Fireball"],
      book: ["Nv3: Fireball"],
    });
  });
});
