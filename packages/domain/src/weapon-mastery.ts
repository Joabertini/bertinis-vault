/**
 * Weapon mastery, 2024's answer to "why would anyone pick a maul".
 *
 * Every 2024 weapon carries one mastery property — Cleave, Graze, Nick, Push,
 * Sap, Slow, Topple, Vex — and five classes let a character actually use some
 * of them. The number is the class's, the weapons are the player's, and both
 * are needed: knowing that a greatsword has Graze is no use if nothing says
 * how many kinds of weapon this character may use it on.
 *
 * The books do not say what happens when a character has the feature from two
 * classes. The 2024 multiclassing rules name exactly three features with
 * special handling — Extra Attack, Spellcasting, and alternative Armor Class —
 * and weapon mastery is not among them. The reading taken here is the same one
 * the rules state for Extra Attack: the features do not stack, and the larger
 * number is the one that counts. Summing them would be the aggressive reading,
 * and a character who is told they may master eight weapons when the table
 * says five is a character whose sheet is wrong.
 */

export type WeaponMasteryGrant = {
  countByLevel: number[];
  meleeOnly: boolean;
};

export type MasteryClassEntry = {
  classId: string;
  level: number;
  mastery?: WeaponMasteryGrant | null;
};

/** How many kinds of weapon one class lets a character master at its level. */
export function masteryCountFor(grant: WeaponMasteryGrant | null | undefined, level: number): number {
  if (!grant) return 0;
  // The table is written for levels 1 through 20 and indexed from zero. A
  // level outside it is clamped rather than read past the end, which would
  // hand back `undefined` and turn the whole count into NaN.
  const index = Math.min(Math.max(Math.trunc(level), 1), grant.countByLevel.length) - 1;
  return grant.countByLevel[index] ?? 0;
}

/**
 * The number a whole character may master, across every class they have.
 *
 * The count is per class level, not per character level: a fighter 3 / rogue 2
 * reads the fighter table at 3, not at 5.
 */
export function weaponMasterySlots(entries: MasteryClassEntry[]): number {
  return entries.reduce(
    (highest, entry) => Math.max(highest, masteryCountFor(entry.mastery, entry.level)),
    0,
  );
}

/** True when every class that grants mastery restricts it to melee weapons. */
export function masteryIsMeleeOnly(entries: MasteryClassEntry[]): boolean {
  const granting = entries.filter((entry) => entry.mastery && entry.level >= 1);
  if (granting.length === 0) return false;
  // A barbarian/fighter is not held to the barbarian's melee restriction: the
  // fighter's own feature is what lets them master a longbow.
  return granting.every((entry) => entry.mastery?.meleeOnly === true);
}

/** A weapon the player named, and the property it would bring. */
export type MasteryPick = {
  /** The weapon's id, as the item index knows it. */
  itemId: string;
  /** Its mastery property, or null when the weapon has none. */
  property: string | null;
  /** True when the weapon's property costs no slot. */
  free?: boolean;
};

export type MasteryProblem =
  | { kind: "over-limit"; picked: number; allowed: number }
  | { kind: "no-property"; itemId: string }
  | { kind: "duplicate"; itemId: string };

/**
 * What is wrong with a set of picks, reported rather than corrected.
 *
 * A weapon with no mastery property is the interesting one: a 2014 weapon in a
 * 2024 character's hands is a legal weapon and an illegal mastery pick, and
 * saying so is more useful than dropping it silently.
 */
export function masteryProblems(picks: MasteryPick[], allowed: number): MasteryProblem[] {
  const problems: MasteryProblem[] = [];
  const seen = new Set<string>();
  let spent = 0;

  for (const pick of picks) {
    if (seen.has(pick.itemId)) {
      problems.push({ kind: "duplicate", itemId: pick.itemId });
      continue;
    }
    seen.add(pick.itemId);

    if (!pick.property) {
      problems.push({ kind: "no-property", itemId: pick.itemId });
      continue;
    }
    if (!pick.free) spent += 1;
  }

  if (spent > allowed) problems.push({ kind: "over-limit", picked: spent, allowed });

  return problems;
}
