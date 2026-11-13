import { describe, expect, test } from "vitest";

import { applyAction, type Anvil } from "../src/lib/actions";
import { coerceBuilderState, freshDraft } from "../src/lib/builder-state";
import { allOptions } from "../src/lib/catalog";
import { resolveDraft } from "../src/lib/derive";
import { settleDraft } from "../src/lib/settle";

/**
 * The sweep: every class, every species and every background of both
 * editions, built the way a click builds them, has to derive.
 *
 * The other tests pick the characters someone thought of. This one picks all
 * of them, because the failures that reached players were the ones nobody
 * thought of: a background whose grant the settle step did not expect, a
 * species whose bonus the derivation could not read. Each pick goes through
 * the action, the settle step and a reload through the store's coercion —
 * the same three steps the web and the desktop take after every click.
 *
 * Paired, not crossed: every species and every background meets one class,
 * every class meets one species and one background. The full product is
 * tens of thousands of builds and says little more than this does.
 */

const EDITIONS = ["2014", "2024"] as const;

const anvilOf = (rulesVersion: (typeof EDITIONS)[number]): Anvil => ({
  draft: { ...freshDraft(rulesVersion === "2014" ? "5e-2014" : "5e-2024"), characterName: "Barrido" },
  scratch: { pool: [], bound: [], sets: [] },
});

/** One pick as a click makes it: the action, then the settle step on what it left. */
function pick(at: Anvil, prop: "race" | "class" | "background", entry: ReturnType<typeof allOptions>[number]): Anvil {
  const next = applyAction(at, { type: "pick", prop, entry });
  return { draft: settleDraft(next.draft, at.draft), scratch: next.scratch };
}

/** What a reload gives back. */
const reloaded = (draft: Anvil["draft"]) => coerceBuilderState(JSON.parse(JSON.stringify(draft)));

function build(
  rulesVersion: (typeof EDITIONS)[number],
  race: ReturnType<typeof allOptions>[number],
  cls: ReturnType<typeof allOptions>[number],
  background: ReturnType<typeof allOptions>[number],
) {
  let at = anvilOf(rulesVersion);
  at = pick(at, "race", race);
  at = pick(at, "class", cls);
  at = pick(at, "background", background);
  return reloaded(at.draft);
}

describe.each(EDITIONS)("reglas %s", (rulesVersion) => {
  const races = allOptions("race", rulesVersion);
  const classes = allOptions("class", rulesVersion);
  const backgrounds = allOptions("background", rulesVersion);

  test("hay catálogo que barrer", () => {
    expect(races.length).toBeGreaterThan(0);
    expect(classes.length).toBeGreaterThan(0);
    expect(backgrounds.length).toBeGreaterThan(0);
  });

  const at = <T,>(list: T[], index: number): T => list[index % list.length] as T;

  test("cada clase deriva", () => {
    const fallas: string[] = [];
    classes.forEach((cls, index) => {
      try {
        const resolved = resolveDraft(build(rulesVersion, at(races, index), cls, at(backgrounds, index)));
        if (resolved.status !== "ready") fallas.push(`${cls.label}: ${resolved.missing.join(", ")}`);
      } catch (error) {
        fallas.push(`${cls.label}: ${(error as Error).message}`);
      }
    });
    expect(fallas).toEqual([]);
  });

  test("cada especie deriva", () => {
    const fallas: string[] = [];
    races.forEach((race, index) => {
      try {
        const resolved = resolveDraft(build(rulesVersion, race, at(classes, index), at(backgrounds, index)));
        if (resolved.status !== "ready") fallas.push(`${race.label}: ${resolved.missing.join(", ")}`);
      } catch (error) {
        fallas.push(`${race.label} (${race.source}): ${(error as Error).message}`);
      }
    });
    expect(fallas).toEqual([]);
  });

  test("cada trasfondo deriva", () => {
    const fallas: string[] = [];
    backgrounds.forEach((background, index) => {
      try {
        const resolved = resolveDraft(build(rulesVersion, at(races, index), at(classes, index), background));
        if (resolved.status !== "ready") fallas.push(`${background.label}: ${resolved.missing.join(", ")}`);
      } catch (error) {
        fallas.push(`${background.label} (${background.source}): ${(error as Error).message}`);
      }
    });
    expect(fallas).toEqual([]);
  });

  test("lo que se elige sobrevive a la recarga", () => {
    const draft = build(rulesVersion, at(races, 0), at(classes, 0), at(backgrounds, 0));
    expect(reloaded(draft)).toEqual(draft);
  });
});
