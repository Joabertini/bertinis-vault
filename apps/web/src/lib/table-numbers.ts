/**
 * The numbers a session asks for out loud.
 *
 * The Forge already derives what the export needs — hit points, armour class,
 * proficiency bonus, spell save DC — because Foundry recomputes everything else
 * on its own. That leaves the player who opens the Codex at the table without
 * the first three things anyone is ever asked for: roll initiative, what is
 * your passive Perception, how far can you move.
 *
 * None of these is stored. They are read off the build every time, so they
 * cannot drift from the scores the sheet already shows.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import { raceInfoFor } from "./index-options";

/**
 * The walking speed in feet, or null when the race is not picked or not known.
 *
 * Known limit: measured, **none of the 98 subrace rows carries a speed** — they
 * carry only their ability increase. So a wood elf reads its base 30 rather
 * than the 35 the book gives it. Pinned in the test, so the day the index grows
 * the field this fails instead of staying quietly wrong.
 */
export function speedFor(state: BuilderState, rulesVersion: RulesVersion): number | null {
  if (!state.raceId) return null;
  const row = raceInfoFor(state.raceId, state.subraceId, rulesVersion) as
    | { speed?: number | null }
    | null;

  return typeof row?.speed === "number" ? row.speed : null;
}

/** Small, Medium — whatever the race prints. Null when it prints nothing. */
export function sizeFor(state: BuilderState, rulesVersion: RulesVersion): string | null {
  if (!state.raceId) return null;
  const row = raceInfoFor(state.raceId, state.subraceId, rulesVersion) as
    | { size?: string | string[] | null }
    | null;

  const size = row?.size;
  if (Array.isArray(size)) return size[0] ?? null;
  return typeof size === "string" && size ? size : null;
}

const modifier = (score: number) => Math.floor((score - 10) / 2);

/**
 * The initiative bonus.
 *
 * Dexterity alone. Alert, Jack of All Trades and a handful of subclass features
 * change it, and none of them is read here — a number that is right for most
 * characters and silently wrong for a few is the failure this project keeps
 * finding, so the sheet says what feeds it.
 */
export function initiativeFor(build: CharacterBuild): number {
  return modifier(build.abilities.final.dex);
}

/**
 * Passive Perception: 10 + Wisdom modifier, plus proficiency when the character
 * has the skill.
 *
 * Expertise would double the proficiency and is not read, because the build
 * cannot express expertise at all yet — see `docs/AUDITORIA-CREACION.md`. A
 * rogue with expertise in Perception reads 5 low here, and that is worth
 * knowing rather than hiding.
 */
export function passivePerceptionFor(build: CharacterBuild): number {
  const proficient = (build.choices.normalized?.proficiencies ?? []).some(
    (entry) => entry.kind === "skill" && /^percepci|^perception/i.test(entry.label),
  );

  return 10 + modifier(build.abilities.final.wis) + (proficient ? build.derived.proficiencyBonus : 0);
}
