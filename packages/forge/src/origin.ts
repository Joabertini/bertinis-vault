/**
 * Customizing Your Origin — Tasha's, as a rule rather than as a habit.
 *
 * The books print a species' increase in **blocks**: a gnome gets +2 and its
 * subrace gets +1, a mountain dwarf gets +2 and +2, a 2014 human gets six +1s.
 * Tasha's lets a player move each block whole to an ability of their choice,
 * and forbids landing two of them on the same one — that is the difference
 * between moving a +2 and inventing a +3.
 *
 * The Forge used to model this as a pot of loose points with the level-up cap
 * borrowed as a ceiling. That allowed +1/+1/+1 for a gnome, which is 2024's
 * shape and not this rule's, and it let the +2 be split in half. It also
 * applied the rule to every 2014 character whether or not the table uses it.
 *
 * So: blocks, assigned one ability each, and only when the player asks for it.
 */

import { ABILITY_IDS, type AbilityId } from "./abilities";
import type { AbilityBonusMap } from "@bertinis-vault/domain";

/**
 * The blocks a species hands over, largest first.
 *
 * Order is presentation only — the +2 is the one a player places first — but it
 * is stable, so a block does not change places while it is being assigned.
 */
export function originBlocksFor(printed: AbilityBonusMap): number[] {
  return ABILITY_IDS.flatMap((ability) => {
    const amount = printed[ability] ?? 0;
    return amount > 0 ? [amount] : [];
  }).sort((left, right) => right - left);
}

/**
 * Which ability holds each block, or null where none does.
 *
 * Best effort rather than all-or-nothing. A draft written before this rule was
 * a switch can hold a spread no legal move produces — a gnome at +1/+1/+1 —
 * and refusing to read it would leave the player staring at an editor that
 * disagrees with their own sheet. Matching what fits and leaving the rest
 * unassigned shows the work as unfinished, which is what it is.
 */
export function assignmentFrom(
  bonuses: AbilityBonusMap,
  blocks: number[],
): (AbilityId | null)[] {
  const held = ABILITY_IDS.flatMap((ability) => {
    const amount = bonuses[ability] ?? 0;
    return amount > 0 ? [{ ability, amount }] : [];
  }).sort((left, right) => right.amount - left.amount);

  const taken = new Set<AbilityId>();

  return blocks.map((block) => {
    const match = held.find((entry) => entry.amount === block && !taken.has(entry.ability));
    if (!match) return null;
    taken.add(match.ability);
    return match.ability;
  });
}

/**
 * The bonus map an assignment produces.
 *
 * Two blocks on one ability cannot be expressed here, which is the point: the
 * restriction is enforced by the shape rather than by a check that something
 * has to remember to run.
 */
export function bonusesFromAssignment(
  blocks: number[],
  assignment: (AbilityId | null)[],
): AbilityBonusMap {
  const bonuses: AbilityBonusMap = {};

  blocks.forEach((block, index) => {
    const ability = assignment[index];
    if (!ability) return;
    bonuses[ability] = block;
  });

  return bonuses;
}

/**
 * Put a block on an ability, moving whatever was there out of the way.
 *
 * A player dragging the +2 onto Constitution when the +1 is already there
 * means to swap them, not to stack them — and stacking is the one thing the
 * rule forbids. Swapping is the only reading that is both what they meant and
 * legal.
 */
export function placeBlock(
  assignment: (AbilityId | null)[],
  index: number,
  ability: AbilityId,
): (AbilityId | null)[] {
  const next = [...assignment];
  const displaced = next.findIndex((entry) => entry === ability);

  if (displaced >= 0 && displaced !== index) next[displaced] = next[index] ?? null;
  next[index] = ability;

  return next;
}

/** Whether every block has found an ability. */
export function assignmentComplete(assignment: (AbilityId | null)[]): boolean {
  return assignment.every((entry) => entry !== null);
}
