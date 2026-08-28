/**
 * Armadura y arma que el personaje no sabe usar.
 *
 * Lo encontró un jugador: la cámara de equipo lo dejó ponerle armadura a un
 * mago sin decirle nada. Ponérsela es legal y a veces es lo que uno quiere —
 * lo que no puede pasar es que nadie lo diga, porque la penalización viaja a
 * Foundry con el personaje y cae sobre casi cada tirada.
 */

import { describe, expect, test } from "vitest";

import { gearProficienciesFor } from "../src/lib/gear-proficiencies";
import { armorCategoryOf, armorWarningFor, weaponWarningFor } from "../src/lib/gear-warnings";

const wizard = gearProficienciesFor([{ classId: "wizard" }], "2014");
const fighter = gearProficienciesFor([{ classId: "fighter" }], "2014");

const chainMail = { type: "HA", name: "Chain Mail" };
const leather = { type: "LA", name: "Leather Armor" };
const shield = { type: "S", name: "Shield" };
const longsword = { name: "Longsword", weaponCategory: "martial", rarity: null };
const dagger = { name: "Dagger", weaponCategory: "simple", rarity: null };

describe("categoría de armadura", () => {
  test("lee los códigos de 5etools", () => {
    expect(armorCategoryOf({ type: "LA" })).toBe("lgt");
    expect(armorCategoryOf({ type: "MA" })).toBe("med");
    expect(armorCategoryOf({ type: "HA" })).toBe("hvy");
    expect(armorCategoryOf({ type: "S" })).toBe("shl");
  });

  test("una fila de 2024 trae el libro pegado al código", () => {
    // "HA|XPHB". La categoría es la mitad de adelante y el resto es la fuente.
    expect(armorCategoryOf({ type: "HA|XPHB" })).toBe("hvy");
  });

  test("lo que no es armadura no tiene categoría", () => {
    expect(armorCategoryOf({ type: "M" })).toBeNull();
    expect(armorCategoryOf({ type: null })).toBeNull();
  });
});

describe("armadura", () => {
  test("el mago con cota de malla recibe el aviso", () => {
    const warning = armorWarningFor(chainMail, wizard);
    expect(warning).not.toBeNull();
    // El aviso dice qué pasa, no qué falta: "sin competencia" no le sirve a
    // nadie para decidir.
    expect(warning).toContain("desventaja");
    expect(warning).toContain("conjuros");
  });

  test("el mago con escudo también, y con la palabra escudo", () => {
    // El escudo es el que un jugador levanta esperando +2 y nada más.
    expect(armorWarningFor(shield, wizard)).toContain("escudo");
  });

  test("el guerrero con cota de malla no recibe nada", () => {
    expect(armorWarningFor(chainMail, fighter)).toBeNull();
    expect(armorWarningFor(shield, fighter)).toBeNull();
  });

  test("el mago con armadura ligera tampoco: no la tiene y sigue sin tenerla", () => {
    // El mago de 2014 no es competente con ninguna armadura.
    expect(armorWarningFor(leather, wizard)).not.toBeNull();
  });

  test("sin clase elegida no se avisa nada", () => {
    // Todavía no hay personaje del que decir que no sabe usarla.
    expect(armorWarningFor(chainMail, null)).toBeNull();
  });
});

describe("arma", () => {
  test("el mago con espada larga recibe el aviso", () => {
    expect(weaponWarningFor(longsword, wizard)).toContain("competencia");
  });

  test("el mago con daga no: es una de las cinco que su clase le da", () => {
    expect(weaponWarningFor(dagger, wizard)).toBeNull();
  });

  test("el guerrero no recibe aviso por ningún arma mundana", () => {
    expect(weaponWarningFor(longsword, fighter)).toBeNull();
    expect(weaponWarningFor(dagger, fighter)).toBeNull();
  });

  test("un arma mágica no se juzga", () => {
    // La fila se llama "Scimitar of Speed" y dnd5e mide la competencia contra
    // la cimitarra que tiene debajo, que desde acá no se ve. Avisar sería
    // adivinar, y adivinaría mal con cualquiera que sepa usar cimitarras.
    const magic = { name: "Scimitar of Speed", weaponCategory: "martial", rarity: "very rare" };
    expect(weaponWarningFor(magic, wizard)).toBeNull();
  });

  test("lo que no es arma no se juzga", () => {
    expect(weaponWarningFor({ name: "Rope", weaponCategory: null, rarity: null }, wizard)).toBeNull();
  });
});
