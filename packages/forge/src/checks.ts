/**
 * What the character actually rolls.
 *
 * The sheet already knew *which* proficiencies a character has. It never said
 * how much each one adds, which is the thing a player looks up most: the whole
 * question at a table is "what do I roll for Stealth?", and the answer is a
 * number, not a checkmark.
 *
 * Every skill is listed, not only the proficient ones. A character rolls
 * Athletics whether or not they trained for it, and that is exactly the moment
 * they do not know the number by heart — showing only what they are good at
 * hides the rolls they are about to get wrong.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import { skillIdByName } from "@bertinis-vault/contracts";

import type { AbilityId } from "./abilities";

/**
 * Which ability each skill is rolled with, read off the installed dnd5e
 * (5.3.3) rather than written from memory. 2024 changed none of them.
 */
const ABILITY_BY_SKILL: Record<string, AbilityId> = {
  acrobatics: "dex",
  "animal handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight of hand": "dex",
  stealth: "dex",
  survival: "wis",
};

export type Check = {
  /** The English name, which is what the index and the payload speak. */
  name: string;
  ability: AbilityId;
  modifier: number;
  proficient: boolean;
  /** Only ever true for a skill, and only when proficiency is doubled. */
  expert: boolean;
};

const modifierOf = (score: number) => Math.floor((score - 10) / 2);

/** Normalized the way the proficiency entries are matched elsewhere. */
const keyOf = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * The six saving throws.
 *
 * Proficiency comes from the first class alone. That is the rule rather than a
 * simplification: a wizard who takes a level of fighter does not gain
 * Constitution saves, and a builder that granted them would hand out the
 * single most valuable save in the game for free.
 */
export function savingThrowChecksFor(build: CharacterBuild): Check[] {
  const entries = build.choices.normalized?.proficiencies ?? [];
  // Read from `id`, not `label`: the label is display text — "Constitucion" —
  // and the ability code is what the entry carries to be matched against.
  const proficient = new Set(
    entries
      .filter((entry) => entry.kind === "savingThrow")
      .map((entry) => entry.id ?? keyOf(entry.label)),
  );

  const abilities: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

  return abilities.map((ability) => {
    const isProficient = proficient.has(ability);
    return {
      name: ability,
      ability,
      modifier:
        modifierOf(build.abilities.final[ability]) +
        (isProficient ? build.derived.proficiencyBonus : 0),
      proficient: isProficient,
      expert: false,
    };
  });
}

/**
 * The eighteen skills.
 *
 * Expertise doubles the proficiency bonus rather than adding a second one, and
 * it only ever applies on top of a proficiency — a skill marked expert without
 * being marked proficient is a build that is wrong somewhere else, counted
 * once here rather than twice.
 */
export function skillChecksFor(build: CharacterBuild): Check[] {
  const entries = build.choices.normalized?.proficiencies ?? [];

  const held = new Set(
    entries.filter((entry) => entry.kind === "skill").map((entry) => keyOf(entry.label)),
  );
  const doubled = new Set(
    entries.filter((entry) => entry.kind === "expertise").map((entry) => keyOf(entry.label)),
  );

  return Object.keys(skillIdByName)
    .sort()
    .map((name) => {
      const ability = ABILITY_BY_SKILL[name] ?? "dex";
      const proficient = held.has(name);
      const expert = proficient && doubled.has(name);

      return {
        name,
        ability,
        modifier:
          modifierOf(build.abilities.final[ability]) +
          (proficient ? build.derived.proficiencyBonus * (expert ? 2 : 1) : 0),
        proficient,
        expert,
      };
    });
}
