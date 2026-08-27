import { describe, expect, test } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";

import {
  FOUNDRY_WEAPON_IDS,
  foundryWeaponId,
  masteryOptionsFor,
  masteryPlanFor,
} from "../src/lib/weapon-mastery";

describe("los ids que Foundry lee", () => {
  test("minusculas y sin separadores", () => {
    expect(foundryWeaponId("Light Crossbow")).toBe("lightcrossbow");
    expect(foundryWeaponId("War Pick")).toBe("warpick");
    expect(foundryWeaponId("Longsword")).toBe("longsword");
  });

  /*
   * La prueba de conformidad, en las dos direcciones. Un arma del indice que
   * no cae en un id de Foundry se exportaria como maestria de nada; un id de
   * Foundry sin arma del indice seria una maestria que el jugador no puede
   * elegir.
   */
  test("cada id de Foundry tiene un arma que el jugador puede elegir", () => {
    const ids = new Set(masteryOptionsFor("2024").map((option) => option.id));
    expect([...FOUNDRY_WEAPON_IDS].filter((id) => !ids.has(id))).toEqual([]);
  });

  /*
   * La otra direccion. Si el indice suma un arma con maestria que dnd5e no
   * tiene como objeto base, este test la nombra: o dnd5e la agrego y hay que
   * sumarla a la lista, o no la tiene y queda fuera a proposito. Lo que no
   * puede pasar es que aparezca sin que nadie lo note.
   */
  test("las armas del indice que Foundry no conoce son exactamente estas", () => {
    const rows = forRulesVersion(collections.item ?? [], "2024") as {
      name: string;
      mastery?: string[] | null;
      rarity?: string | null;
    }[];

    const unknown = rows
      .filter((row) => row.mastery?.length && (!row.rarity || row.rarity === "none"))
      .map((row) => row.name)
      .filter((name) => !FOUNDRY_WEAPON_IDS.has(foundryWeaponId(name)))
      .sort();

    expect(unknown).toEqual([
      "Antimatter Rifle",
      "Automatic Rifle",
      "Hunting Rifle",
      "Laser Pistol",
      "Laser Rifle",
      "Psychic Blade",
      "Revolver",
      "Semiautomatic Pistol",
      "Shotgun",
      "Staff",
      "Wooden Staff",
    ]);
  });

  test("los objetos magicos no son una opcion aparte", () => {
    const labels = masteryOptionsFor("2024").map((option) => option.label);
    expect(labels).not.toContain("Dagger of Venom");
    expect(labels).toContain("Dagger");
  });
});

describe("cuantas armas puede dominar", () => {
  test("una clase que no la concede no ofrece nada", () => {
    expect(masteryPlanFor([{ classId: "wizard", level: 12 }], "2024").count).toBe(0);
  });

  test("2014 no la tiene en absoluto", () => {
    expect(masteryPlanFor([{ classId: "fighter", level: 12 }], "2014").count).toBe(0);
  });

  test("el guerrero sube con el nivel", () => {
    expect(masteryPlanFor([{ classId: "fighter", level: 1 }], "2024").count).toBe(3);
    expect(masteryPlanFor([{ classId: "fighter", level: 4 }], "2024").count).toBe(4);
    expect(masteryPlanFor([{ classId: "fighter", level: 16 }], "2024").count).toBe(6);
  });

  test("el barbaro solo cuerpo a cuerpo", () => {
    const plan = masteryPlanFor([{ classId: "barbarian", level: 5 }], "2024");

    expect(plan.meleeOnly).toBe(true);
    expect(plan.options.map((option) => option.id)).not.toContain("longbow");
    expect(plan.options.map((option) => option.id)).toContain("greataxe");
  });

  /*
   * Dos clases que la conceden dan la MAS ALTA, no la suma: la tabla de cada
   * clase imprime un numero para un personaje de esa clase, y sumar dos
   * inventa un numero que ninguna tabla imprime.
   */
  test("con dos clases se toma la mas alta, no la suma", () => {
    const plan = masteryPlanFor(
      [{ classId: "fighter", level: 4 }, { classId: "rogue", level: 2 }],
      "2024",
    );

    expect(plan.count).toBe(4);
  });

  test("la restriccion de cuerpo a cuerpo cede si alguna clase no la tiene", () => {
    const plan = masteryPlanFor(
      [{ classId: "barbarian", level: 3 }, { classId: "fighter", level: 3 }],
      "2024",
    );

    expect(plan.meleeOnly).toBe(false);
    expect(plan.options.map((option) => option.id)).toContain("longbow");
  });
});

describe("lo que llega al payload", () => {
  const base = { ...initialState, abilityBonuses: {}, levelChoices: {} };

  test("un guerrero de 2024 exporta sus maestrias como ids", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      rulesVersion: "5e-2024",
      classId: "fighter",
      subclassId: "",
      level: 5,
      weaponMasteryIds: ["longsword", "greataxe"],
    });

    expect(snapshot.choices.weaponMasteries).toEqual(["longsword", "greataxe"]);
  });

  /*
   * Un borrador puede quedar con maestrias de una clase que el jugador ya
   * cambio. Exportarlas seria darle al personaje una competencia que su ficha
   * nunca le concedio.
   */
  test("una maestria de una clase que ya no tiene no viaja", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      rulesVersion: "5e-2024",
      classId: "wizard",
      subclassId: "",
      level: 5,
      weaponMasteryIds: ["longsword"],
    });

    expect(snapshot.choices.weaponMasteries).toBeUndefined();
  });

  test("elegir de mas se recorta a lo que la clase permite", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      rulesVersion: "5e-2024",
      classId: "rogue",
      subclassId: "",
      level: 3,
      weaponMasteryIds: ["dagger", "rapier", "shortsword", "scimitar"],
    });

    expect(snapshot.choices.weaponMasteries).toEqual(["dagger", "rapier"]);
  });

  test("2014 no exporta maestrias en absoluto", () => {
    const snapshot = buildCanonicalSnapshot({
      ...base,
      rulesVersion: "5e-2014",
      classId: "fighter",
      subclassId: "",
      level: 5,
      weaponMasteryIds: ["longsword"],
    });

    expect(snapshot.choices.weaponMasteries).toBeUndefined();
  });
});
