import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot } from "../src/lib/builder";
import { freshDraft } from "../src/lib/builder-state";
import { itemInfoFor } from "../src/lib/index-options";
import { fitsOpenPick, purseFor } from "../src/lib/purse";
import { kitItemIds, startingKitFor } from "../src/lib/starting-kit";

/*
 * A3 del plan de reseñas: "elegí oro en vez de equipo, agregué equipo a mano y
 * el oro no bajó". El oro es la alternativa al equipo; quedarse con los dos no
 * es elegir.
 */

const priceOf = (id: string, rulesVersion: "2014" | "2024") => itemInfoFor(id, rulesVersion)?.value ?? 0;

/** A 2024 fighter, with the class row answered by `pick` on its options. */
const fighter2024 = (pick: (copper: number, items: number) => boolean) => {
  const [row] = startingKitFor("fighter", "", "2024").filter((entry) => entry.source === "class");
  const option = row!.options.find((entry) => pick(entry.copper, entry.items.length))!;
  return { row: row!, option };
};

const draft2024 = { ...freshDraft("5e-2024"), classId: "fighter", level: 1 };
const draft2014 = { ...freshDraft("5e-2014"), classId: "fighter", level: 1 };

describe("el oro inicial paga lo que se agrega a mano", () => {
  test("elegir el oro y comprar armadura, espada y escudo lo descuenta", () => {
    const { row, option } = fighter2024((copper, items) => copper > 0 && items === 0);
    const state = {
      ...draft2024,
      kitChoices: { [row.key]: option.key },
      weaponId: "longsword",
      armorId: "chain-mail",
      extraEquipmentText: "shield",
    };

    const spent = priceOf("longsword", "2024") + priceOf("chain-mail", "2024") + priceOf("shield", "2024");
    expect(spent).toBeGreaterThan(0);

    const purse = purseFor(state, "2024");
    expect(purse.startingCopper).toBe(option.copper);
    expect(purse.spentCopper).toBe(spent);
    expect(purse.balanceCopper).toBe(option.copper - spent);
    expect(purse.purchases.map((entry) => entry.id).sort()).toEqual(["chain-mail", "longsword", "shield"]);

    // Lo que cruza a Foundry es lo que queda, no el oro entero. La ficha
    // exportable pide especie y trasfondo; el trasfondo trae su propia fila
    // de kit, asi que se compara contra el saldo del mismo estado.
    const exportable = { ...state, raceId: "human", backgroundId: "soldier" };
    const left = purseFor(exportable, "2024").balanceCopper;
    expect(left).toBeLessThan(purseFor(exportable, "2024").startingCopper);
    expect(buildCanonicalSnapshot(exportable).choices.startingCopper).toBe(left);
  });

  test("tomar el equipo no es comprarlo", () => {
    const { row, option } = fighter2024((_, items) => items > 0);
    const state = {
      ...draft2024,
      kitChoices: { [row.key]: option.key },
      extraEquipmentText: kitItemIds(option).join("\n"),
    };

    const purse = purseFor(state, "2024");
    expect(purse.purchases).toEqual([]);
    expect(purse.balanceCopper).toBe(option.copper);
  });

  test("una copia de más sí se compra", () => {
    const { row, option } = fighter2024((_, items) => items > 0);
    const javelins = option.items.find((item) => item.id === "javelin");
    expect(javelins).toBeTruthy();

    const state = {
      ...draft2024,
      kitChoices: { [row.key]: option.key },
      extraEquipmentText: [...kitItemIds(option), "javelin"].join("\n"),
    };

    const purse = purseFor(state, "2024");
    expect(purse.purchases).toEqual([{ id: "javelin", quantity: 1, copper: priceOf("javelin", "2024") }]);
  });

  test("las armas que el kit deja elegir no se cobran", () => {
    // 2014: "(b) dos armas marciales". Las dos son del kit, no compras.
    const rows = startingKitFor("fighter", "", "2014").filter((entry) => entry.source === "class");
    const row = rows.find((entry) =>
      entry.options.some((option) => option.openPicks.filter((pick) => pick.category === "weaponMartial").length === 2),
    )!;
    const two = row.options.find((option) => option.openPicks.length === 2)!;

    const state = {
      ...draft2014,
      kitChoices: { [row.key]: two.key },
      weaponId: "longsword",
      extraEquipmentText: "battleaxe",
    };
    expect(purseFor(state, "2014").purchases).toEqual([]);

    // Una tercera ya es compra: cualquiera de las tres, una sola.
    const third = { ...state, extraEquipmentText: "battleaxe\nwarhammer" };
    expect(purseFor(third, "2014").purchases).toHaveLength(1);
  });

  test("gastar de más se avisa y exporta la bolsa vacía", () => {
    const { row, option } = fighter2024((copper, items) => copper > 0 && items === 0);
    const state = {
      ...draft2024,
      kitChoices: { [row.key]: option.key },
      armorId: "plate-armor",
    };

    const purse = purseFor(state, "2024");
    expect(purse.balanceCopper).toBeLessThan(0);
    expect(
      buildCanonicalSnapshot({ ...state, raceId: "human", backgroundId: "soldier" }).choices.startingCopper,
    ).toBeUndefined();
  });

  test("lo que no tiene precio no descuenta, y se cuenta", () => {
    expect(itemInfoFor("trinket", "2024")?.value ?? null).toBeNull();

    const { row, option } = fighter2024((copper, items) => copper > 0 && items === 0);
    const purse = purseFor(
      { ...draft2024, kitChoices: { [row.key]: option.key }, extraEquipmentText: "trinket\nuna carta de mi madre" },
      "2024",
    );

    expect(purse.unpriced).toBe(1);
    expect(purse.spentCopper).toBe(0);
    // La nota escrita a mano no es un objeto: ni se cobra ni se cuenta.
    expect(purse.purchases.map((entry) => entry.id)).toEqual(["trinket"]);
  });
});

describe("qué responde a una elección abierta del kit", () => {
  const row = (id: string) => itemInfoFor(id, "2024")!;

  test("armas por categoría y alcance", () => {
    expect(fitsOpenPick(row("longsword"), { category: "weaponMartial", label: "" })).toBe(true);
    expect(fitsOpenPick(row("longsword"), { category: "weaponMartialMelee", label: "" })).toBe(true);
    expect(fitsOpenPick(row("longsword"), { category: "weaponSimple", label: "" })).toBe(false);
    expect(fitsOpenPick(row("longbow"), { category: "weaponMartialMelee", label: "" })).toBe(false);
    expect(fitsOpenPick(row("dagger"), { category: "weaponSimpleMelee", label: "" })).toBe(true);
  });

  test("foco, instrumento, juego y los nombres sin objeto", () => {
    expect(fitsOpenPick(row("amulet"), { category: "focusSpellcastingHoly", label: "" })).toBe(true);
    expect(fitsOpenPick(row("amulet"), { category: "unresolved", label: "holy symbol" })).toBe(true);
    expect(fitsOpenPick(row("lute"), { category: "instrumentMusical", label: "" })).toBe(true);
    expect(fitsOpenPick(row("dice-set"), { category: "unresolved", label: "gaming set" })).toBe(true);
    expect(fitsOpenPick(row("lute"), { category: "setGaming", label: "" })).toBe(false);
  });
});
