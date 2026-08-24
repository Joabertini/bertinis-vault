/**
 * The identifiers Foundry's `dnd5e` system uses for skills and languages.
 *
 * A skill is not a document. It is a field on the actor, keyed by a three
 * letter code — `arc`, `slt`, `prc` — and writing anything else creates a path
 * that silently does nothing. The builder classified a proficiency as a skill
 * by matching its name and then stored the name, so every character reached
 * Foundry with its skill proficiencies written to `system.skills.Arcana`.
 *
 * The names here are the English ones the index uses. The builder's Spanish
 * labels are display text and never travel.
 *
 * This lives beside the payload schema rather than in the rules layer because
 * it is part of the wire contract: it says which identifiers a payload is
 * allowed to carry, which is the schema's business and not the rules'.
 */

/** Every skill in the game, keyed as `dnd5e` keys it. */
export const skillIdByName: Record<string, string> = {
  acrobatics: "acr",
  "animal handling": "ani",
  arcana: "arc",
  athletics: "ath",
  deception: "dec",
  history: "his",
  insight: "ins",
  intimidation: "itm",
  investigation: "inv",
  medicine: "med",
  nature: "nat",
  perception: "prc",
  performance: "prf",
  persuasion: "per",
  religion: "rel",
  "sleight of hand": "slt",
  stealth: "ste",
  survival: "sur",
};

/**
 * The standard languages, keyed as `dnd5e` keys them.
 *
 * Deliberately only the standard and exotic lists. A language outside them —
 * a setting's own, a secret one like Thieves' Cant — has no key to write, and
 * belongs in the actor's free-text custom field instead.
 */
export const languageIdByName: Record<string, string> = {
  common: "common",
  dwarvish: "dwarvish",
  elvish: "elvish",
  giant: "giant",
  gnomish: "gnomish",
  goblin: "goblin",
  halfling: "halfling",
  orc: "orc",
  abyssal: "abyssal",
  celestial: "celestial",
  draconic: "draconic",
  "deep speech": "deep",
  infernal: "infernal",
  primordial: "primordial",
  sylvan: "sylvan",
  undercommon: "undercommon",
  druidic: "druidic",
  "thieves' cant": "cant",
  "common sign language": "communal",
};

function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const skillIds = new Set(Object.values(skillIdByName));

/**
 * The `dnd5e` key for a skill name, or null when it is not a skill.
 *
 * A value that is already a key comes back unchanged, so a caller that has
 * done the mapping does not have it undone.
 */
export function skillIdFor(name: string): string | null {
  const normalized = key(name);
  if (skillIds.has(normalized)) return normalized;

  return skillIdByName[normalized] ?? null;
}

/** The `dnd5e` key for a language name, or null when it has none. */
export function languageIdFor(name: string): string | null {
  return languageIdByName[key(name)] ?? null;
}

/**
 * Split language names into the ones Foundry has a key for and the rest.
 *
 * The rest are not dropped: `dnd5e` keeps a free-text field beside the keyed
 * list for exactly this, and a language a player wrote in themselves is still
 * something they chose.
 */
export function partitionLanguages(names: string[]): { known: string[]; custom: string[] } {
  const known: string[] = [];
  const custom: string[] = [];

  for (const name of names) {
    const id = languageIdFor(name);
    if (id) {
      if (!known.includes(id)) known.push(id);
    } else if (name.trim() && !custom.includes(name.trim())) {
      custom.push(name.trim());
    }
  }

  return { known, custom };
}
