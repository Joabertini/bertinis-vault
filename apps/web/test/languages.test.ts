/**
 * Idiomas, medidos contra el índice en vez de contra una tabla escrita a mano.
 *
 * La tabla vieja tenía 25 razas de las 160 que trae el índice. Todo lo que
 * quedaba afuera —cinco de cada seis especies, las 98 subrazas y los 161
 * trasfondos— caía en "Common" y nada más.
 */

import { describe, expect, test } from "vitest";

import { assignLanguages, languagePlanFor, languagesSatisfied } from "../src/lib/languages";
import { speciesLanguagesFor } from "../src/lib/species";

describe("lo que concede la especie", () => {
  test("el enano habla Común y Enano", () => {
    const plan = languagePlanFor("dwarf", "", "", "2014");
    expect(plan.fixed).toEqual(["Common", "Dwarvish"]);
    expect(plan.offers).toHaveLength(0);
  });

  test("el semielfo suma una elección a lo que ya habla", () => {
    const plan = languagePlanFor("half-elf", "", "", "2014");
    expect(plan.fixed).toEqual(["Common", "Elvish"]);
    expect(plan.offers).toHaveLength(1);
    expect(plan.offers[0]?.count).toBe(1);
    // Ni Común ni Élfico: ya los habla, y ofrecerlos sería gastar la elección
    // en nada.
    expect(plan.offers[0]?.options).not.toContain("Common");
    expect(plan.offers[0]?.options).not.toContain("Elvish");
  });

  test("la subraza suma, no pisa", () => {
    // Este es el caso que la tabla vieja no podía tener: el gnomo de las
    // profundidades habla Infracomún encima del Común y el Gnómico de todo
    // gnomo. Es la misma regla que los rasgos, y la contraria a la velocidad.
    const gnome = speciesLanguagesFor("gnome", "", "2014");
    const deep = speciesLanguagesFor("gnome", "gnome-deep", "2014");

    expect(gnome?.fixed).toContain("Gnomish");
    expect(deep?.fixed).toContain("Gnomish");
    expect(deep?.fixed).toContain("Undercommon");
  });

  test("una especie de 2024 no concede ninguno: la regla se mudó al trasfondo", () => {
    const plan = languagePlanFor("dwarf", "", "", "2024");
    expect(plan.fixed).toEqual(["Common"]);
  });
});

describe("lo que concede el trasfondo", () => {
  test("el Acólito da dos a elección", () => {
    const plan = languagePlanFor("", "", "acolyte", "2014");
    const offer = plan.offers.find((entry) => entry.from === "trasfondo");
    expect(offer?.count).toBe(2);
  });

  test("especie y trasfondo se preguntan por separado", () => {
    // Leídos como una sola lista chocaban: dos elecciones de la especie
    // llenaban también el cupo del trasfondo y la cámara no se podía cerrar.
    const plan = languagePlanFor("half-elf", "", "acolyte", "2014");
    expect(plan.offers.map((offer) => offer.from)).toEqual(["especie", "trasfondo"]);

    // Los ocho estandar y nada mas: las dos ofertas son `anyStandard`, y el
    // Draconico —que es exotico— no lo paga ninguna.
    const assigned = assignLanguages(plan, ["Giant", "Orc", "Halfling"]);
    expect(assigned[0]).toHaveLength(1);
    expect(assigned[1]).toHaveLength(2);
  });

  test("una lista con nombre se ofrece como está", () => {
    const plan = languagePlanFor("", "", "boros-legionnaire", "2014");
    const offer = plan.offers.find((entry) => entry.from === "trasfondo");
    // "Celestial, Draconico, Goblin o el que acuerdes con tu DM": una sola
    // eleccion, con lista abierta y tres nombres que igual vale imprimir.
    expect(offer?.options).toEqual(["Celestial", "Draconic", "Goblin"]);
    expect(offer?.count).toBe(1);
    expect(offer?.isOpen).toBe(true);
  });
});

describe("el hueco que no es una lista", () => {
  test("se cuenta, no se ofrece", () => {
    // "Any one language that you and your DM agree is appropriate". Ofrecer
    // los ocho estándar sería inventar una regla que el libro no escribió.
    const plan = languagePlanFor("aven", "", "", "2014");
    expect(plan.offers).toHaveLength(1);
    expect(plan.offers[0]?.isOpen).toBe(true);
    // Ni un nombre: el libro no da ninguno.
    expect(plan.offers[0]?.options).toEqual([]);
  });

  test("lo escrito a mano paga la oferta abierta", () => {
    const plan = languagePlanFor("aven", "", "", "2014");
    const assigned = assignLanguages(plan, ["Thayan"]);
    expect(assigned[0]).toEqual(["Thayan"]);
  });

  test("la cámara no se cierra hasta que el hueco esté lleno", () => {
    const plan = languagePlanFor("aven", "", "", "2014");
    expect(languagesSatisfied(plan, [])).toBe(false);
    expect(languagesSatisfied(plan, ["Thayan"])).toBe(true);
  });
});

describe("cierre de la cámara", () => {
  test("una oferta a medio pagar no alcanza", () => {
    const plan = languagePlanFor("half-elf", "", "acolyte", "2014");
    expect(languagesSatisfied(plan, ["Giant"])).toBe(false);
    expect(languagesSatisfied(plan, ["Giant", "Orc", "Halfling"])).toBe(true);
  });

  test("un idioma repetido no paga dos ofertas", () => {
    const plan = languagePlanFor("half-elf", "", "acolyte", "2014");
    expect(languagesSatisfied(plan, ["Orc", "Orc", "Orc"])).toBe(false);
  });
});
