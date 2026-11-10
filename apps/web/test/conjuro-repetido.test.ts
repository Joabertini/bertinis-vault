import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, firstOfEachSpell, initialState } from "../src/lib/builder";
import { slugOf } from "../src/lib/index-options";

describe("firstOfEachSpell", () => {
  test("se queda con el primero, no con el ultimo", () => {
    const kept = firstOfEachSpell([
      { spellId: "shield", preparation: "prepared" as const, label: "escrito" },
      { spellId: "shield", preparation: "unprepared" as const, label: "otorgado" },
    ]);

    expect(kept).toEqual([{ spellId: "shield", preparation: "prepared", label: "escrito" }]);
  });

  test("un 'always' posterior sube la preparacion del que queda", () => {
    const kept = firstOfEachSpell([
      { spellId: "bless", preparation: "prepared" as const, label: "escrito" },
      { spellId: "bless", preparation: "always" as const, label: "dominio" },
    ]);

    expect(kept).toEqual([{ spellId: "bless", preparation: "always", label: "escrito" }]);
  });
});

describe("en la exportacion", () => {
  test("un conjuro de dominio que el clerigo tambien eligio sale una vez y siempre preparado", () => {
    const snapshot = buildCanonicalSnapshot({
      ...initialState,
      rulesVersion: "5e-2014",
      raceId: slugOf("Human"),
      sourceBooks: { [`race:${slugOf("Human")}`]: "PHB" },
      classId: "cleric",
      subclassId: "life-domain",
      level: 3,
      featId: "",
      backgroundId: "",
      cantripsText: "",
      spellsText: "Nv1: Bless",
      spellbookText: "",
    });
    const blesses = (snapshot.choices.normalized?.spells ?? []).filter((entry) => entry.spellId === "bless");

    expect(blesses).toHaveLength(1);
    expect(blesses[0]?.preparation).toBe("always");
  });
});
