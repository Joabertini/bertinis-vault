import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState } from "../src/lib/builder";
import { classEntryFor } from "../src/lib/classing";

describe("una subclase solo existe desde el nivel que la da", () => {
  test("un guerrero 2 no es Caballero Arcano, un guerrero 3 si", () => {
    expect(classEntryFor({ classId: "fighter", subclassId: "eldritch-knight", level: 2 }, "2014").subclassId).toBeUndefined();
    expect(classEntryFor({ classId: "fighter", subclassId: "eldritch-knight", level: 3 }, "2014").subclassId).toBe(
      "eldritch-knight",
    );
  });

  test("una clase extra que bajo de nivel no exporta la subclase ni su lanzamiento", () => {
    const snapshot = buildCanonicalSnapshot({
      ...initialState,
      classId: "wizard",
      subclassId: "",
      level: 1,
      extraClasses: [{ classId: "fighter", subclassId: "eldritch-knight", level: 2 }],
    });
    const fighter = snapshot.classing.classes.find((entry) => entry.classId === "fighter");

    expect(fighter?.subclassId).toBeUndefined();
    expect(fighter?.subclassCasterProgression ?? null).toBeNull();
  });
});
