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
 * A subrace's own speed wins when it prints one — the wood elf walks 35 where
 * the elf walks 30 — and its silence leaves the race's standing, which is how
 * the hill dwarf keeps the dwarf's 25.
 */
export function speedFor(state: BuilderState, rulesVersion: RulesVersion): number | null {
  if (!state.raceId) return null;
  const row = raceInfoFor(state.raceId, state.subraceId, rulesVersion) as
    | { speed?: number | null }
    | null;

  return typeof row?.speed === "number" ? row.speed : null;
}

/**
 * How far this character sees in the dark, and how far they move otherwise.
 *
 * Darkvision is not a detail. It decides whether the party lights a torch, and
 * a torch decides whether anything in the dungeon can see the party — which is
 * the difference between a scouting rogue and a lit-up one. It never appeared
 * anywhere in the Forge, so a drow's 120 feet and a human's nothing looked the
 * same on the sheet.
 *
 * The other movement modes are here for the same reason: an Aarakocra's 50-foot
 * fly speed is the entire argument for playing one, and it was not shown.
 */
export type RaceSenses = {
  /** Feet. Null for the species that see no better than a human. */
  darkvision: number | null;
  /** Sight without light at all. Rarer, and not the same thing. */
  blindsight: number | null;
  /** Every way this character moves except walking, in feet. */
  otherSpeeds: { mode: "burrow" | "climb" | "fly" | "swim"; feet: number }[];
};

const MOVEMENT_MODES = ["burrow", "climb", "fly", "swim"] as const;

export function sensesFor(state: BuilderState, rulesVersion: RulesVersion): RaceSenses | null {
  if (!state.raceId) return null;
  const row = raceInfoFor(state.raceId, state.subraceId, rulesVersion) as
    | {
        darkvision?: number | null;
        blindsight?: number | null;
        speeds?: Partial<Record<string, number>> | null;
      }
    | null;
  if (!row) return null;

  const speeds = row.speeds ?? {};
  const otherSpeeds = MOVEMENT_MODES.flatMap((mode) => {
    const feet = speeds[mode];
    return typeof feet === "number" ? [{ mode, feet }] : [];
  });

  return {
    darkvision: typeof row.darkvision === "number" ? row.darkvision : null,
    blindsight: typeof row.blindsight === "number" ? row.blindsight : null,
    otherSpeeds,
  };
}

/**
 * Every size this species offers, in 5etools' letters.
 *
 * One for most, and two — always Small and Medium — for the thirty that let
 * the player decide: the 2024 human, aasimar and tiefling, plus twenty-seven
 * from the later 2014 books. Empty when the species states none, and empty
 * for the one species that prints `"V"` for variable, because `dnd5e` has no
 * key for "it depends" and inventing one would put a size on the sheet nobody
 * chose.
 */
export function sizeOptionsFor(state: BuilderState, rulesVersion: RulesVersion): string[] {
  if (!state.raceId) return [];
  const row = raceInfoFor(state.raceId, state.subraceId, rulesVersion) as
    | { sizes?: string[] | null }
    | null;

  return (row?.sizes ?? []).filter((letter) => letter in FOUNDRY_SIZE);
}

/**
 * The size the character actually is, in 5etools' letters.
 *
 * A species offering one answers for itself. A species offering two waits for
 * the player, and stays null until they answer — an unanswered question is not
 * the first option. The stored answer is re-checked against the offer, so a
 * player who picked Small as a halfling and then reforged as a goliath does
 * not carry the halfling's answer onto a species that never asked.
 */
export function sizeFor(state: BuilderState, rulesVersion: RulesVersion): string | null {
  const options = sizeOptionsFor(state, rulesVersion);
  if (options.length === 1) return options[0]!;
  if (options.length > 1 && options.includes(state.sizeChoice)) return state.sizeChoice;
  return null;
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

/** What `dnd5e` calls each size the index prints. */
const FOUNDRY_SIZE: Record<string, "tiny" | "sm" | "med" | "lg" | "huge" | "grg"> = {
  T: "tiny",
  S: "sm",
  M: "med",
  L: "lg",
  H: "huge",
  G: "grg",
};

/** How the sheet says it, in Spanish. */
const SIZE_LABEL: Record<string, string> = {
  tiny: "Diminuto",
  sm: "Pequeno",
  med: "Mediano",
  lg: "Grande",
  huge: "Enorme",
  grg: "Gargantuesco",
};

/**
 * The size as Foundry keys it, or null when nothing has answered for it yet.
 *
 * Null travels as an absent field, and Foundry reads an absent size as Medium
 * — which is what an unanswered question should look like on the sheet, and
 * what it looked like before any of this existed.
 */
export function foundrySizeFor(
  state: BuilderState,
  rulesVersion: RulesVersion,
): "tiny" | "sm" | "med" | "lg" | "huge" | "grg" | null {
  const size = sizeFor(state, rulesVersion);
  return size ? (FOUNDRY_SIZE[size] ?? null) : null;
}

/** The size, said the way the sheet says it. */
export function sizeLabelFor(state: BuilderState, rulesVersion: RulesVersion): string | null {
  const size = foundrySizeFor(state, rulesVersion);
  return size ? (SIZE_LABEL[size] ?? null) : null;
}

/** One of 5etools' letters, said the same way — for the question, not the sheet. */
export function sizeNameOf(letter: string): string {
  const key = FOUNDRY_SIZE[letter];
  return (key && SIZE_LABEL[key]) || letter;
}
