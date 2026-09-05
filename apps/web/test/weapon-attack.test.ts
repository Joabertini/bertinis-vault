/*
 * La regla de ataque contra el catalogo entero.
 *
 * `packages/domain` la prueba con filas escritas a mano, que es lo correcto
 * para la aritmetica. Lo que eso no puede contestar es si las 325 armas
 * publicadas caben en las formas que la regla dice leer -- y este repo ya se
 * comio dos veces la respuesta: `size` como array de dos, y `property` como
 * objeto. Ver [[parser-fuente-ajena-dos-muestras]].
 *
 * Esta suite corre la regla sobre todas las filas reales y exige que ninguna
 * caiga fuera de lo modelado.
 */

import { collections } from "@bertinis-vault/vetools-index";
import { isRangedWeapon, weaponAbilityFor, weaponAttackFor } from "@bertinis-vault/domain";
import { describe, expect, test } from "vitest";

type WeaponRow = {
  name: string;
  source: string;
  type?: string | null;
  properties?: string[] | null;
  damage?: string | null;
  versatileDamage?: string | null;
  weaponCategory?: string | null;
};

const weapons = ((collections.item ?? []) as WeaponRow[]).filter((row) => row.weaponCategory);

describe("la regla de ataque contra las armas publicadas", () => {
  test("hay un catalogo que valga la pena recorrer", () => {
    // Si el indice se regenerara vacio, todo lo de abajo pasaria por nada.
    expect(weapons.length).toBeGreaterThan(300);
  });

  test("ninguna fila tira, y todas salen con una aptitud", () => {
    const broken: string[] = [];

    for (const row of weapons) {
      try {
        const attack = weaponAttackFor({
          weapon: row,
          scores: { str: 16, dex: 14 },
          proficiencyBonus: 3,
          proficient: true,
        });
        if (attack.ability !== "str" && attack.ability !== "dex") {
          broken.push(`${row.name}/${row.source}: aptitud ${attack.ability}`);
        }
      } catch (error) {
        broken.push(`${row.name}/${row.source}: ${(error as Error).message}`);
      }
    }

    expect(broken).toEqual([]);
  });

  test("las 2024 no se leen como a distancia por el sufijo del tipo", () => {
    /*
     * El error que este test existe para atrapar: `type` trae "M|XPHB" en las
     * 73 armas cuerpo a cuerpo de 2024, y un `=== "M"` las habria mandado
     * todas a Destreza.
     */
    const melee2024 = weapons.filter((row) => (row.type ?? "").startsWith("M|"));
    expect(melee2024.length).toBeGreaterThan(50);
    expect(melee2024.filter((row) => isRangedWeapon(row))).toEqual([]);
  });

  test("las que el catalogo no tipa siguen siendo cuerpo a cuerpo", () => {
    // Veintiseis baculos, varas y varitas magicas, todas de 1d6 y de mano.
    const untyped = weapons.filter((row) => !row.type);
    expect(untyped.length).toBeGreaterThan(20);
    expect(untyped.every((row) => !isRangedWeapon(row))).toBe(true);
  });

  test("finesse existe en las dos ediciones y elige la mejor", () => {
    const finesse = weapons.filter((row) => (row.properties ?? []).includes("F"));
    expect(finesse.length).toBeGreaterThan(40);

    const rapier = weapons.find((row) => row.name === "Rapier" && row.source === "XPHB");
    expect(rapier).toBeDefined();
    expect(weaponAbilityFor(rapier!, { str: 1, dex: 4 }).ability).toBe("dex");
    expect(weaponAbilityFor(rapier!, { str: 4, dex: 1 }).ability).toBe("str");
  });

  test("un arma a distancia real usa Destreza", () => {
    const longbow = weapons.find((row) => row.name === "Longbow" && row.source === "PHB");

    expect(longbow).toBeDefined();
    expect(
      weaponAttackFor({
        weapon: longbow!,
        scores: { str: 8, dex: 18 },
        proficiencyBonus: 3,
        proficient: true,
      }),
    ).toMatchObject({ ability: "dex", attackBonus: 7, damage: "1d8 + 4" });
  });
});
