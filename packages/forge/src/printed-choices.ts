/**
 * Choices the 2024 Player's Handbook prints on a species, class or subclass that
 * the index does not carry, so nothing ever asked them.
 *
 * Each is asked as a talent pool of one, with option ids `choice:<key>|<option>`,
 * and answered into `printedChoices`. Two more kinds of printed choice live
 * where their machinery already is: the gnome's lineage is a spell variant (below),
 * and the skills of Lore, Battle Master and the barbarian are proficiency offers
 * (`grants.ts`).
 */

import type { BuilderState } from "./builder-state";
import { classEntriesFor } from "./classing";
import { featIdsFor } from "./feats";
import { featGearGrantsFor } from "./index-options";
import type { TalentPool } from "./optional-features";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

type Option = {
  id: string;
  label: string;
  armor?: string[];
  weaponCategories?: string[];
  extraCantrip?: boolean;
};

type Choice = {
  key: string;
  name: string;
  chamber: "species" | "class";
  species?: string;
  classId?: string;
  subclassId?: string;
  level?: number;
  options: Option[];
};

const named = (...labels: string[]): Option[] =>
  labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""), label }));

const CHOICES: Choice[] = [
  {
    key: "draconic-ancestry",
    name: "Draconic Ancestry",
    chamber: "species",
    species: "dragonborn",
    options: named(
      "Black (Acid)", "Blue (Lightning)", "Brass (Fire)", "Bronze (Lightning)", "Copper (Acid)",
      "Gold (Fire)", "Green (Poison)", "Red (Fire)", "Silver (Cold)", "White (Cold)",
    ),
  },
  {
    key: "giant-ancestry",
    name: "Giant Ancestry",
    chamber: "species",
    species: "goliath",
    options: named(
      "Cloud's Jaunt", "Fire's Burn", "Frost's Chill", "Hill's Tumble", "Stone's Endurance", "Storm's Thunder",
    ),
  },
  {
    key: "divine-order",
    name: "Divine Order",
    chamber: "class",
    classId: "cleric",
    level: 1,
    options: [
      { id: "protector", label: "Protector", armor: ["heavy"], weaponCategories: ["martial"] },
      { id: "thaumaturge", label: "Thaumaturge", extraCantrip: true },
    ],
  },
  {
    key: "primal-order",
    name: "Primal Order",
    chamber: "class",
    classId: "druid",
    level: 1,
    options: [
      { id: "magician", label: "Magician", extraCantrip: true },
      { id: "warden", label: "Warden", armor: ["medium"], weaponCategories: ["martial"] },
    ],
  },
  {
    key: "hunters-prey",
    name: "Hunter's Prey",
    chamber: "class",
    classId: "ranger",
    subclassId: "hunter",
    level: 3,
    options: named("Colossus Slayer", "Horde Breaker"),
  },
  {
    key: "elemental-affinity",
    name: "Elemental Affinity",
    chamber: "class",
    classId: "sorcerer",
    subclassId: "draconic-sorcery",
    level: 6,
    options: named("Acid", "Cold", "Fire", "Lightning", "Poison"),
  },
];

const PREFIX = "choice:";

/** The choices this draft has reached. */
export function printedChoicesFor(state: BuilderState): Choice[] {
  if (state.rulesVersion !== "5e-2024") return [];
  const entries = state.classId
    ? classEntriesFor(
        { classId: state.classId, subclassId: state.subclassId, level: state.level },
        state.extraClasses,
        "2024",
      )
    : [];
  return CHOICES.filter((choice) => {
    if (choice.species) return state.raceId === choice.species;
    return entries.some(
      (entry) =>
        entry.classId === choice.classId &&
        entry.level >= (choice.level ?? 1) &&
        (!choice.subclassId || entry.subclassId === choice.subclassId),
    );
  });
}

/** The reached choices that have an answer, with the option taken. */
export function printedAnswersFor(state: BuilderState) {
  return printedChoicesFor(state).flatMap((choice) => {
    const option = choice.options.find((entry) => entry.id === state.printedChoices?.[choice.key]);
    return option ? [{ choice, option }] : [];
  });
}

export function printedPoolsFor(state: BuilderState, chamber?: "species" | "class"): TalentPool[] {
  return printedChoicesFor(state)
    .filter((choice) => !chamber || choice.chamber === chamber)
    .map((choice) => ({
      name: choice.name,
      count: 1,
      options: choice.options.map((option) => ({
        id: `${PREFIX}${choice.key}|${option.id}`,
        label: option.label,
        source: "XPHB",
        notes: [],
        eligible: true,
      })),
    }));
}

/** The pool ids standing for the answers given, for the pools to count. */
export function printedTalentIdsFor(state: BuilderState): string[] {
  return printedAnswersFor(state).map(({ choice, option }) => `${PREFIX}${choice.key}|${option.id}`);
}

/** A toggle on a printed option: the new answers, or null if the id is not one. */
export function printedToggle(state: BuilderState, id: string): Record<string, string> | null {
  if (!id.startsWith(PREFIX)) return null;
  const [key, option] = id.slice(PREFIX.length).split("|");
  if (!key || !option) return null;
  const next = { ...(state.printedChoices ?? {}) };
  if (next[key] === option) delete next[key];
  else next[key] = option;
  return next;
}

/** The answers as sheet features, `"Divine Order: Protector"`. */
export function printedFeaturesFor(state: BuilderState) {
  return printedAnswersFor(state).map(({ choice, option }) => ({
    label: `${choice.name}: ${option.label}`,
    source: choice.chamber === "species" ? ("race" as const) : ("class" as const),
  }));
}

/** Extra cantrips by class: Thaumaturge and Magician each add one. */
export function printedCantripBonusFor(state: BuilderState): Record<string, number> {
  return Object.fromEntries(
    printedAnswersFor(state)
      .filter(({ option }) => option.extraCantrip)
      .map(({ choice }) => [choice.classId as string, 1]),
  );
}

/** Armour and weapon training from feats and from printed choices. */
export function gearGrantsFor(state: BuilderState, rulesVersion: RulesVersion) {
  return [
    ...featGearGrantsFor(featIdsFor(state), rulesVersion),
    ...printedAnswersFor(state)
      .filter(({ option }) => option.armor || option.weaponCategories)
      .map(({ choice, option }) => ({
        id: choice.key,
        label: option.label,
        armor: option.armor ?? [],
        weaponCategories: option.weaponCategories ?? [],
        weaponClauses: [] as string[],
      })),
  ];
}

const lineageEntry = (variant: string, kind: "known" | "prepared", names: string[]) => ({
  kind,
  variant,
  ability: { fixed: null, choose: ["int", "wis", "cha"] },
  level: 1,
  spellLevel: null,
  recharge: null,
  uses: null,
  names: names.map((name) => ({ name, source: "xphb", castLevel: null })),
  filters: [],
  choices: [],
});

/** The gnome's lineage, in the shape the index uses for the elf's. */
export const GNOME_LINEAGE_SPELLS = [
  lineageEntry("Forest Gnome", "known", ["minor illusion"]),
  lineageEntry("Forest Gnome", "prepared", ["speak with animals"]),
  lineageEntry("Rock Gnome", "known", ["mending", "prestidigitation"]),
];
