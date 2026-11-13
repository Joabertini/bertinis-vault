import { describe, expect, test } from "vitest";

import { initialState } from "../src/lib/builder-state";
import { resolveDraft } from "../src/lib/derive";
import {
  callingView,
  coverView,
  derivedOf,
  foundryPayloadOf,
  gearView,
  giftsView,
  growthView,
  pointBuyView,
  recordView,
  sheetView,
  spellsView,
  tomeView,
} from "../src/lib/screens";

/**
 * The screens, described once in the package. The web and the desktop app
 * draw from these, so what they say has to match the derivation they sit on.
 */

const draft = initialState;

describe("las pantallas del paquete", () => {
  test("todas responden sobre el personaje de ejemplo", () => {
    for (const view of [
      sheetView,
      growthView,
      giftsView,
      gearView,
      callingView,
      pointBuyView,
      spellsView,
      foundryPayloadOf,
      recordView,
      coverView,
      tomeView,
    ]) {
      expect(() => JSON.stringify(view(draft))).not.toThrow();
    }
  });

  test("derivar una vez da lo mismo que derivar de nuevo", () => {
    // La derivación estampa la hora (`exportedAt`, `createdAt`, `updatedAt`),
    // y la memoria guarda la de la primera vez: se compara sin ellas.
    const sinHora = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value), (key, inner) =>
        key === "exportedAt" || key === "createdAt" || key === "updatedAt" ? undefined : inner,
      );
    expect(sinHora(derivedOf(draft))).toEqual(sinHora(resolveDraft(draft)));
    expect(sinHora(derivedOf({ ...draft, level: 7 }))).toEqual(sinHora(resolveDraft({ ...draft, level: 7 })));
  });

  test("el registro vivo lee los números de la derivación", () => {
    const resolved = resolveDraft(draft);
    const record = recordView(draft);
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(record.ready).toBe(true);
    expect(record.hp).toBe(resolved.snapshot.derived.hp);
    expect(record.ac).toBe(resolved.snapshot.derived.ac);
    expect(record.abilities.map((row) => row.score)).toEqual(
      (["str", "dex", "con", "int", "wis", "cha"] as const).map((id) => resolved.snapshot.abilities.final[id]),
    );
    expect(record.saves).toHaveLength(6);
    expect(record.skills).toHaveLength(18);
  });

  test("un borrador sin elegir nada no inventa números", () => {
    const empty = { ...draft, raceId: "", classId: "", backgroundId: "" };
    const record = recordView(empty);
    expect(record.ready).toBe(false);
    expect(record.hp).toBeNull();
    expect(record.saves).toEqual([]);
  });

  test("el tomo trae la cheatsheet del personaje", () => {
    const tome = tomeView(draft);
    expect(tome.derives).toBe(true);
    expect(tome.playbook.rules.length).toBeGreaterThan(0);
  });
});
