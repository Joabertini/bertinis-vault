/**
 * Una armadura puesta, un escudo en mano, y el arma elegida no se duplica.
 *
 * Todo lo que el constructor archivaba como `armor` llegaba a Foundry
 * equipado, asi que una armadura en su casilla y otra en la mochila viajaban
 * las dos puestas, y dnd5e calculaba la CA con la que leyera primero. Y la
 * casilla sumaba: elegir la cota de malla que el kit ya habia puesto en la
 * mochila exportaba dos.
 */

import { describe, expect, test } from "vitest";

import { initialState, settleEquipment, type BuilderState } from "../src/lib/builder";
import { resolveDraft } from "../src/lib/derive";

function fighter(patch: Partial<BuilderState>): BuilderState {
  return {
    ...initialState,
    rulesVersion: "5e-2014",
    characterName: "Prueba",
    raceId: "human",
    classId: "fighter",
    backgroundId: "soldier",
    dex: 14,
    ...patch,
  };
}

function payloadOf(state: BuilderState) {
  const resolved = resolveDraft(state);
  if (resolved.status !== "ready" || !resolved.payload) throw new Error("no derivo");
  return { payload: resolved.payload, snapshot: resolved.snapshot };
}

describe("una sola armadura puesta", () => {
  test("la de la casilla se usa, la de la mochila viaja guardada", () => {
    const { payload, snapshot } = payloadOf(
      fighter({ armorId: "chain-mail", extraEquipmentText: "leather-armor" }),
    );

    const worn = payload.equipment.filter((entry) => entry.equipped);
    const names = (entries: typeof payload.equipment) =>
      entries.map((entry) => entry.ref.hash.split("_")[0]);

    expect(names(worn)).toContain("chain%20mail");
    expect(names(worn)).not.toContain("leather%20armor");
    expect(names(payload.equipment)).toContain("leather%20armor");
    // La CA del constructor es la de la cota, la misma que va a leer Foundry.
    expect(snapshot.derived.ac).toBe(16);
  });

  test("sin casilla, la primera de la mochila es la puesta", () => {
    const { payload } = payloadOf(
      fighter({ armorId: "", extraEquipmentText: "leather-armor\nchain-mail" }),
    );
    const worn = payload.equipment.filter((entry) => entry.equipped).map((entry) => entry.ref.hash);

    expect(worn.some((hash) => hash.startsWith("leather%20armor"))).toBe(true);
    expect(worn.some((hash) => hash.startsWith("chain%20mail"))).toBe(false);
  });
});

describe("la casilla nombra, no suma", () => {
  test("elegir la cota que el kit ya puso deja una cota", () => {
    const { payload } = payloadOf(
      fighter({ armorId: "chain-mail", extraEquipmentText: "chain-mail" }),
    );
    const chains = payload.equipment.filter((entry) => entry.ref.hash.startsWith("chain%20mail"));

    expect(chains).toHaveLength(1);
    expect(chains[0]!.quantity).toBe(1);
    expect(chains[0]!.equipped).toBe(true);
  });

  test("el arma de la casilla sale de las que ya cargaba", () => {
    const { payload } = payloadOf(fighter({ weaponId: "dagger", extraEquipmentText: "dagger x2" }));
    const daggers = payload.equipment.filter((entry) => entry.ref.hash.startsWith("dagger"));

    expect(daggers.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0)).toBe(2);
  });
});

describe("settleEquipment", () => {
  const entry = (itemId: string, category: "armor" | "shield" | "weapon" | "gear", quantity = 1) => ({
    itemId,
    label: itemId,
    quantity,
    category,
    ...(category === "armor" ? { armorFormula: "11+DEX" } : {}),
    ...(category === "shield" ? { grantsShieldBonus: true } : {}),
  });

  test("un segundo escudo es equipaje", () => {
    const settled = settleEquipment([], [entry("shield", "shield"), entry("spiked-shield", "shield")]);

    expect(settled.map((item) => item.category)).toEqual(["shield", "gear"]);
    expect(settled[1]!.grantsShieldBonus).toBeUndefined();
  });

  test("la armadura guardada pierde la formula, asi no cuenta para la CA", () => {
    const settled = settleEquipment([entry("chain-mail", "armor")], [entry("leather-armor", "armor")]);

    expect(settled[1]!.category).toBe("gear");
    expect(settled[1]!.armorFormula).toBeUndefined();
  });
});
