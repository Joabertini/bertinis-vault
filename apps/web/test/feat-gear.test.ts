/*
 * What a feat lets the character wear and swing.
 *
 * Two things are pinned here and they are different questions. The first is
 * conformance: the ten feats that state armour or weapons must state them in
 * shapes the reader models, over the whole catalog and not over a sample. The
 * second is the rule itself — that a feat's grant reaches the character, which
 * it did not before: a wizard could spend a level on Heavily Armored and the
 * sheet would still say they could not wear plate.
 */

import { collections } from "@bertinis-vault/vetools-index";
import type { FeatRow } from "@bertinis-vault/vetools-index";
import { describe, expect, test } from "vitest";

import { gearProficienciesFor } from "../src/lib/gear-proficiencies";
import { featGearGrantsFor } from "../src/lib/index-options";

const feats = (collections.feat ?? []) as FeatRow[];
const withGear = feats.filter((row) => row.gear);

const ARMOR_WORDS = ["light", "medium", "heavy", "shield"];
const CATEGORY_WORDS = ["simple", "martial"];

describe("las competencias que declaran las dotes", () => {
  test("hay un catalogo que valga la pena recorrer", () => {
    expect(feats.length).toBeGreaterThan(250);
  });

  test("diez dotes dicen que se puede vestir o blandir", () => {
    /*
     * Medido sobre el bundle, no sobre la conversacion: seis de armadura y
     * cuatro de armas. Si el numero cae, el generador dejo de leer un campo y
     * la dote llega a la ficha sin dar nada.
     */
    expect(withGear.length).toBe(10);
  });

  test("ninguna dote declara una palabra que el lector no modele", () => {
    const strange: string[] = [];

    for (const row of withGear) {
      const gear = row.gear!;
      for (const word of gear.armor) {
        if (!ARMOR_WORDS.includes(word)) strange.push(`${row.name}: armadura "${word}"`);
      }
      for (const word of gear.weaponCategories) {
        if (!CATEGORY_WORDS.includes(word)) strange.push(`${row.name}: categoria "${word}"`);
      }
    }

    expect(strange).toEqual([]);
  });

  test("ninguna dote nombra un arma suelta", () => {
    /*
     * Hoy ninguna lo hace, y por eso la capa web no lee `weaponItems`: una rama
     * sin datos es una rama sin test. El dia que un libro nombre un arma en una
     * dote, este test cae primero y la rama se escribe entonces.
     */
    expect(withGear.flatMap((row) => row.gear!.weaponItems)).toEqual([]);
  });
});

describe("el escudo cambia de dote entre ediciones", () => {
  /*
   * La divergencia real, y la razon por la que la lectura es por version de
   * reglas y no una sola vez: 2014 pone el escudo en Moderately Armored, 2024
   * en Lightly Armored. Leer la edicion equivocada le regala al personaje un
   * escudo que no compro, o le saca uno que si.
   */
  const armorOf = (featId: string, rulesVersion: "2014" | "2024") =>
    gearProficienciesFor(
      [{ classId: "wizard" }],
      rulesVersion,
      null,
      featGearGrantsFor([featId], rulesVersion),
    ).foundryArmorIds;

  test("bajo 2014 el escudo viene con la armadura media", () => {
    expect(armorOf("moderately-armored", "2014")).toEqual(["med", "shl"]);
    expect(armorOf("lightly-armored", "2014")).toEqual(["lgt"]);
  });

  test("bajo 2024 el escudo viene con la ligera", () => {
    expect(armorOf("moderately-armored", "2024")).toEqual(["med"]);
    expect(armorOf("lightly-armored", "2024")).toEqual(["lgt", "shl"]);
  });
});

describe("la dote llega al personaje", () => {
  test("un mago con Heavily Armored puede vestir pesada, y la ficha dice de donde", () => {
    const profs = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2014",
      null,
      featGearGrantsFor(["heavily-armored"], "2014"),
    );

    expect(profs.foundryArmorIds).toEqual(["hvy"]);
    expect(profs.armor.map((line) => [line.label, line.from])).toEqual([
      ["Armadura pesada", ["heavily-armored"]],
    ]);
  });

  test("Martial Weapon Training da la categoria entera, no una lista", () => {
    const profs = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2024",
      null,
      featGearGrantsFor(["martial-weapon-training"], "2024"),
    );

    expect(profs.foundryWeaponIds).toContain("mar");
    expect(profs.weapons.map((line) => line.label)).toContain("Armas marciales");
  });

  test("una categoria que dnd5e no tiene se dice y no se otorga", () => {
    /*
     * Y cada una en su edicion, porque las dos son de una sola: Gunner es de
     * Tasha y no llega a 2024, y la Tavern Brawler de 2014 no da competencia
     * con armas improvisadas — la de 2024 si. Pedirlas juntas bajo una sola
     * version devuelve la mitad.
     */
    const gunner = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2014",
      null,
      featGearGrantsFor(["gunner"], "2014"),
    );
    const brawler = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2024",
      null,
      featGearGrantsFor(["tavern-brawler"], "2024"),
    );

    // La frase se muestra en castellano; el export no recibe nada, porque no
    // hay codigo ni id que mandarle.
    expect(gunner.weapons.map((line) => line.label)).toContain("Armas de fuego");
    expect(brawler.weapons.map((line) => line.label)).toContain("Armas improvisadas");
    expect(gunner.clauseWeaponIds).toEqual([]);
    expect(brawler.clauseWeaponIds).toEqual([]);
  });

  test("la misma dote no da lo mismo en las dos ediciones", () => {
    // Tavern Brawler 2014 no dice nada de armas; Weapon Master no sobrevive a
    // 2024. Una tabla escrita a mano las habria dado en las dos.
    expect(featGearGrantsFor(["tavern-brawler"], "2014")).toEqual([]);
    expect(featGearGrantsFor(["weapon-master"], "2024")).toEqual([]);
    expect(featGearGrantsFor(["gunner"], "2024")).toEqual([]);
  });

  test("Weapon Master dice cuantas armas se eligen y no elige ninguna", () => {
    const profs = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2014",
      null,
      featGearGrantsFor(["weapon-master"], "2014"),
    );

    expect(profs.weapons.map((line) => line.label)).toContain("4 armas marciales a eleccion");
    expect(profs.clauseWeaponIds).toEqual([]);
    expect(profs.foundryWeaponIds).not.toContain("mar");
  });

  test("una dote que ensancha la categoria no repite el arma de la especie", () => {
    /*
     * El hacha de guerra del enano se nombra porque ninguna clase se la da. En
     * cuanto Martial Weapon Training le da las marciales enteras, nombrarla
     * seria decir lo mismo dos veces.
     */
    const dwarf = {
      id: "dwarf",
      armor: [],
      weaponItems: ["battleaxe", "handaxe", "light hammer", "warhammer"],
      weaponClauses: [],
    };

    const alone = gearProficienciesFor([{ classId: "wizard" }], "2024", dwarf);
    expect(alone.weapons.map((line) => line.label)).toContain("Battleaxe");

    const trained = gearProficienciesFor(
      [{ classId: "wizard" }],
      "2024",
      dwarf,
      featGearGrantsFor(["martial-weapon-training"], "2024"),
    );
    expect(trained.weapons.map((line) => line.label)).not.toContain("Battleaxe");
    // Foundry sigue recibiendo el id: alli un id de mas no cuesta nada, y el
    // set se escribe desde ids.
    expect(trained.speciesWeaponIds).toContain("battleaxe");
  });
});
