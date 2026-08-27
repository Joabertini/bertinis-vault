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
 * has the skill, doubled when they have expertise in it.
 *
 * The doubling is not a rounding detail. A rogue who doubles Perception reads
 * a number the whole table plays against — it is what the DM checks a hidden
 * creature's Stealth against without anyone rolling — and reading it five low
 * silently makes the character worse at the thing they spent their rarest
 * choice on.
 */
export function passivePerceptionFor(build: CharacterBuild): number {
  const entries = build.choices.normalized?.proficiencies ?? [];
  const isPerception = (label: string) => /^percepci|^perception/i.test(label);

  const proficient = entries.some(
    (entry) => entry.kind === "skill" && isPerception(entry.label),
  );
  const expert = entries.some(
    (entry) => entry.kind === "expertise" && isPerception(entry.label),
  );

  // Expertise travels beside the proficiency, never instead of it, so a label
  // marked expert without being marked proficient is a build that is wrong
  // elsewhere — counted once here rather than twice.
  const bonus = proficient ? build.derived.proficiencyBonus * (expert ? 2 : 1) : 0;

  return 10 + modifier(build.abilities.final.wis) + bonus;
}
