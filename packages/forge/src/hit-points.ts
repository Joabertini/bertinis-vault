/**
 * The hit points question the Forge asks, and the answer it sends.
 *
 * Both editions print two ways on every class page — roll the hit die, or take
 * the fixed number the class states — and a table picks one. The builder could
 * only ever average, so a character at a rolling table carried a number their
 * table had never rolled and had nowhere to correct it.
 *
 * The rule itself is in the domain package. This is the shape of the question:
 * which levels there are to ask about, which die each one uses, and what the
 * player has answered so far.
 */

import { averageHitPointsPerLevel, hitDiceByLevel } from "@bertinis-vault/domain";
import type { HitPointsInput } from "@bertinis-vault/contracts";

import type { BuilderState } from "./builder-state";
import { classEntriesFor } from "./classing";
import { featIdsFor } from "./feats";
import { raceInfoFor, subclassInfoFor } from "./index-options";
import { rulesVersionOf } from "./builder-state";

/*
 * The classes read straight from `classing` rather than through `builder`,
 * which imports this file: a cycle here is a blank page at load, not a type
 * error.
 */
function classesOf(state: BuilderState) {
  return classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses.filter((extra) => extra.classId && extra.level >= 1),
    rulesVersionOf(state),
  );
}

/** One row of the roll table: a level, the die it uses, and what was written. */
export type HitPointLevel = {
  /** The character level, which is what the answers are keyed by. */
  level: number;
  die: number;
  /** The class that level was taken in, so the player can see which die is which. */
  classId: string;
  /** What the fixed number would be, so the player can compare before choosing. */
  average: number;
  roll: number | null;
};

/**
 * Every level that has a roll to record.
 *
 * Level 1 is left out: it is the die at maximum in both editions and there is
 * nothing to ask. A multiclass character's levels each carry the die of the
 * class they were taken in, which is why the class travels on the row — a
 * barbarian 1 / wizard 4 asks for four d6s and not four d12s.
 */
export function hitPointLevelsFor(state: BuilderState): HitPointLevel[] {
  const entries = classesOf(state);
  const dice = hitDiceByLevel(entries);
  const classByLevel = entries.flatMap((entry) =>
    Array.from({ length: entry.level }, () => entry.classId),
  );

  return dice.slice(1).map((die, at) => {
    const level = at + 2;
    const roll = state.hpRolls[String(level)];

    return {
      level,
      die,
      classId: classByLevel[at + 1] ?? entries[0]?.classId ?? "",
      average: averageHitPointsPerLevel(die),
      roll: typeof roll === "number" ? roll : null,
    };
  });
}

/**
 * The answers as the contract wants them: a list indexed from level 2.
 *
 * A level with no roll travels as null rather than being skipped, because the
 * position in the list *is* the level — dropping a gap would move every later
 * roll up a level and put hit points on the sheet from a die that was never
 * thrown for it.
 */
export function hitPointsInputFor(state: BuilderState): HitPointsInput | null {
  const bonus = hitPointBonusesFor(state).reduce((sum, entry) => sum + entry.amount, 0);
  const levels = state.hpMethod === "rolled" ? hitPointLevelsFor(state) : [];

  if (!levels.length && bonus === 0) return null;

  return {
    method: levels.length ? "rolled" : "average",
    rolls: levels.map((row) => (row.roll !== null && row.roll <= row.die ? row.roll : null)),
    ...(bonus > 0 ? { bonus } : {}),
  };
}

/** Hit points from somewhere other than the dice, and what gave them. */
export type HitPointBonus = { source: string; amount: number };

/**
 * Every hit point a feat or a trait adds on top of dice and Constitution.
 *
 * The model's standing gap, and a wrong number rather than a missing one: a
 * hill dwarf fighter 5 with Tough is ten plus five hit points over what the
 * sheet showed, and nothing on it said so.
 *
 * - **Tough**, both editions: two per character level.
 * - **Dwarven Toughness**, the 2014 hill dwarf and the 2024 dwarf: one per
 *   character level. Read off the species' own trait list, so any species
 *   that carries the trait gets it without a name kept here.
 * - **Draconic Resilience**, the draconic sorcerer of both editions: one per
 *   sorcerer level once the subclass has it (2024's "3, then 1 a level" is
 *   the same number from level 3).
 * - **Boon of Fortitude**, 2024's epic boon: forty.
 */
export function hitPointBonusesFor(state: BuilderState): HitPointBonus[] {
  const rulesVersion = rulesVersionOf(state);
  const entries = classesOf(state);
  const level = entries.reduce((sum, entry) => sum + entry.level, 0);
  const feats = featIdsFor(state);
  const bonuses: HitPointBonus[] = [];

  if (feats.includes("tough")) bonuses.push({ source: "Duro", amount: 2 * level });

  if (state.raceId) {
    const traits = [
      ...(raceInfoFor(state.raceId, "", rulesVersion)?.traits ?? []),
      ...(state.subraceId ? (raceInfoFor(state.raceId, state.subraceId, rulesVersion)?.traits ?? []) : []),
    ];
    if (traits.includes("Dwarven Toughness")) {
      bonuses.push({ source: "Dureza enana", amount: level });
    }
  }

  for (const entry of entries) {
    if (!entry.subclassId) continue;
    const subclass = subclassInfoFor(entry.subclassId, entry.classId, rulesVersion);
    const resilience = (subclass?.armorClass ?? []).find((option) => option.name === "Draconic Resilience");
    if (resilience && entry.level >= resilience.level) {
      bonuses.push({ source: "Resiliencia draconica", amount: entry.level });
    }
  }

  if (feats.includes("boon-of-fortitude")) bonuses.push({ source: "Don de fortaleza", amount: 40 });

  return bonuses;
}
