import { describe, expect, test } from "vitest";

import { freshDraft } from "../src/lib/builder-state";
import { NOTES_EDITION, playbookFor } from "../src/lib/playbook";

/*
 * C2, tramo 1, del plan de reseñas: la cheatsheet está escrita para 2014. Un
 * personaje 2024 tiene que saber que lee notas de otra edición, en vez de
 * creerse "Rage: 2 usos" sin aviso.
 */

const fighter = (edition: "5e-2014" | "5e-2024") => ({ ...freshDraft(edition), classId: "fighter", level: 5 });

describe("las notas del tomo dicen para qué edición se escribieron", () => {
  test("la cheatsheet es 2014", () => {
    expect(NOTES_EDITION).toBe("2014");
  });

  test("un personaje 2014 las lee sin aviso", () => {
    expect(playbookFor(fighter("5e-2014"), null, "2014").outdated).toBe(false);
  });

  test("un personaje 2024 las lee marcadas como de otra edición", () => {
    const playbook = playbookFor(fighter("5e-2024"), null, "2024");
    expect(playbook.outdated).toBe(true);
    // Siguen ahí: mejor marcadas que borradas.
    expect(playbook.features.length).toBeGreaterThan(0);
  });
});
