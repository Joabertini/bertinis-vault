/**
 * Reading a Foundry actor back into the Vault.
 *
 * A character exported out of Foundry is a `.json` a player already has on
 * disk, and until now it was a one-way trip: the Vault could send one out and
 * never take one back. This closes the loop, which also means a character that
 * lives in Foundry can be filed on the shelf here without being rebuilt.
 *
 * The join is exact, not fuzzy. Every dnd5e item carries
 * `system.identifier` — "paladin", "oath-of-the-ancients", "kender",
 * "rune-carver" — and that string is character-for-character the slug this
 * front already stores. Checked against a real level 5 paladin with 90 items:
 * class, subclass, species, background and all three feats resolved against
 * the index on the identifier alone, including a Kender out of Dragonlance
 * and a Rune Carver out of Bigby's. Matching on printed names would have had
 * to survive translation, punctuation and reprints; this does not.
 *
 * The edition comes out of the file too: `system.source.rules` is "2014" or
 * "2024" on every item, so nobody is asked which books their own character
 * was built from.
 *
 * What the index does not recognise is named in `unresolved` rather than
 * dropped in silence. An import that quietly loses a species is worse than
 * one that says it could not place it.
 */

import { hasSpellbook } from "@bertinis-vault/domain";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import { initialState } from "./builder";
import { entryById } from "./catalog";
import { featChoiceForBackground, levellingFor, optionsFor, slugOf } from "./index-options";

export type ActorImport = {
  state: BuilderState;
  /** What was recognised, for the confirmation the player reads. */
  resolved: string[];
  /** What the index did not know, named so it can be fixed by hand. */
  unresolved: string[];
  /**
   * The picture the actor carries, as Foundry wrote it, or "" when it has none
   * of its own. It is a `data:` URL, an absolute URL, or — nearly always — a
   * path inside the Foundry server's Data folder, which a `.json` cannot carry
   * the bytes of. See `portraitOf`.
   */
  portrait: string;
};

/* The parts of a dnd5e actor this reads. Everything else is ignored. */
type ActorItem = {
  type?: string;
  name?: string;
  system?: {
    identifier?: string;
    levels?: number;
    level?: number;
    type?: { value?: string };
    source?: { rules?: string };
    hd?: { denomination?: string };
    advancement?: unknown;
  };
};

type Actor = {
  name?: string;
  img?: string;
  prototypeToken?: { texture?: { src?: string } };
  type?: string;
  items?: ActorItem[];
  system?: {
    abilities?: Record<string, { value?: number }>;
    details?: Record<string, unknown>;
  };
};

/**
 * The picture an actor brings of its own.
 *
 * Foundry fills `img` with a stock icon when nobody chose one — `icons/…` or
 * `systems/…/icons/…`, mostly SVG — and that is not a portrait. The token's
 * texture is the fallback for a character whose sheet portrait was never set.
 */
export function portraitOf(actor: Pick<Actor, "img" | "prototypeToken">): string {
  for (const candidate of [actor.img, actor.prototypeToken?.texture?.src]) {
    const src = typeof candidate === "string" ? candidate.trim() : "";
    if (!src) continue;
    if (src.startsWith("data:image/")) return src;
    const path = src.split("?")[0]!.toLowerCase();
    if (/^(icons|systems)\//.test(path) || path.endsWith(".svg")) continue;
    if (!/\.(webp|png|jpe?g|gif|avif)$/.test(path)) continue;
    return src;
  }
  return "";
}

/** The id a dnd5e item resolves to, preferring its own identifier. */
function idOf(item: ActorItem): string {
  return item.system?.identifier?.trim() || slugOf(item.name ?? "");
}

/**
 * Which ruleset this actor was built under.
 *
 * Read off the items rather than asked, and by majority rather than from the
 * first one: a 2024 character can carry a spell reprinted out of a 2014 book
 * without being a 2014 character.
 */
function editionOf(items: ActorItem[]): RulesVersion {
  let newer = 0;
  let older = 0;
  for (const item of items) {
    const rules = item.system?.source?.rules;
    if (rules === "2024") newer++;
    else if (rules === "2014") older++;
  }
  return newer > older ? "2024" : "2014";
}

/* ---- hit points ---- */
/**
 * What each level actually gave, out of Foundry's own record of it.
 *
 * dnd5e keeps it on the class item as a `HitPoints` advancement: `"1": "max"`
 * and then one entry per level, either a number that was rolled or `"max"`
 * where the table hands out maximums. It is the only place the answer exists —
 * measured on a real paladin 5, `system.attributes.hp.max` is **null** and only
 * `hp.value` carries the current total.
 *
 * Without this an imported character was rebuilt at the average, which for that
 * paladin is 44 against the 60 on their sheet: sixteen hit points lost on the
 * way in, silently, on a character the player had already played.
 *
 * The level keys are the class's levels, and this reads a single class — which
 * is what the rest of this importer reads — so they are the character's levels
 * too. `"max"` is stored as the die's maximum: not a roll, but what happened.
 */
function hitPointsFromClass(classItem: ActorItem | undefined): {
  hpMethod: "average" | "rolled";
  hpRolls: Record<string, number>;
} {
  const system = classItem?.system as
    | { hd?: { denomination?: string }; advancement?: unknown }
    | undefined;
  const advancement = Array.isArray(system?.advancement)
    ? system.advancement
    : Object.values((system?.advancement ?? {}) as Record<string, unknown>);
  const entry = advancement.find(
    (row): row is { type?: string; value?: Record<string, unknown> } =>
      typeof row === "object" && row !== null && (row as { type?: string }).type === "HitPoints",
  );
  if (!entry?.value) return { hpMethod: "average", hpRolls: {} };

  const die = Number(String(system?.hd?.denomination ?? "").replace(/^d/i, ""));
  const hpRolls: Record<string, number> = {};

  for (const [level, gained] of Object.entries(entry.value)) {
    // Level 1 is the die at maximum in both editions and is not a roll.
    if (level === "1") continue;
    const roll = gained === "max" ? die : Number(gained);
    if (!Number.isInteger(roll) || roll < 1 || roll > 12) continue;
    hpRolls[level] = roll;
  }

  return Object.keys(hpRolls).length
    ? { hpMethod: "rolled", hpRolls }
    : { hpMethod: "average", hpRolls: {} };
}

export function readFoundryActor(raw: unknown): ActorImport | null {
  const actor = raw as Actor;
  if (!actor || typeof actor !== "object") return null;
  // A monster, a vehicle or an unrelated json is not a character sheet.
  if (actor.type !== "character" || !Array.isArray(actor.items)) return null;

  const items = actor.items;
  const rulesVersion = editionOf(items);
  const resolved: string[] = [];
  const unresolved: string[] = [];

  const first = (type: string) => items.find((item) => item.type === type);

  /**
   * One pick, resolved against the index and reported either way.
   *
   * The source book is recorded alongside the id because a build stores it,
   * and because two books can print the same name — without it a shared name
   * resolves to whichever row happens to come first.
   */
  const books: Record<string, string> = {};
  const pick = (
    prop: "race" | "class" | "background" | "subclass",
    item: ActorItem | undefined,
    label: string,
  ): string => {
    if (!item) return "";
    const id = idOf(item);
    if (!id) return "";

    const entry = entryById(prop, rulesVersion, id);
    if (!entry) {
      unresolved.push(`${label}: ${item.name ?? id}`);
      return "";
    }

    books[`${prop}:${id}`] = entry.source;
    resolved.push(`${label}: ${entry.label}`);
    return id;
  };

  const classItem = first("class");
  const classId = pick("class", classItem, "Clase");
  const subclassId = pick("subclass", first("subclass"), "Subclase");
  const raceId = pick("race", first("race"), "Raza");
  const backgroundId = pick("background", first("background"), "Trasfondo");

  const level = Math.min(20, Math.max(1, classItem?.system?.levels ?? classItem?.system?.level ?? 1));

  /*
   * Only the real feats.
   *
   * dnd5e files a character's racial traits, class features and background
   * features as `feat` items too — this paladin carries 26 of them and only
   * three are feats a player chose. `system.type.value` is what tells them
   * apart, and without it an import would hand someone "Divine Smite" and
   * "Kender Curiosity" as if they had spent ability score improvements on them.
   */
  const featIds: string[] = [];
  for (const item of items) {
    if (item.type !== "feat" || item.system?.type?.value !== "feat") continue;

    const id = idOf(item);
    const known = optionsFor({ prop: "feat", rulesVersion, search: item.name ?? id, limit: 40 }).find(
      (option) => option.id === id,
    );
    if (!known) {
      unresolved.push(`Dote: ${item.name ?? id}`);
      continue;
    }
    featIds.push(id);
    resolved.push(`Dote: ${known.label}`);
  }

  /*
   * Where each feat goes.
   *
   * A character can hold more feats than it has ability score improvements —
   * this paladin is level 5, has one improvement at level 4, and carries
   * three. The extras are real: one comes from the background, and Foundry
   * lets a table hand out the rest. So the feats are placed against the three
   * places a build can actually hold one, in order of certainty:
   *
   *   1. the background's own feat, where the background offers it
   *   2. the class's improvement levels, up to this character's level
   *   3. the build's single free feat slot
   *
   * The actor never records which level a feat was taken at, so step 2 uses
   * the levels the class actually offers rather than a guess. That derives
   * the same numbers; it is not a claim about the order they were chosen in.
   *
   * Anything still left over is named. A feat silently dropped is a character
   * that imports weaker than it left.
   */
  const levelChoices: BuilderState["levelChoices"] = {};
  let freeFeatId = "";
  let backgroundFeatId = "";

  const offeredByBackground = new Set(
    (backgroundId ? featChoiceForBackground(backgroundId, rulesVersion)?.options ?? [] : []).map(
      (option) => slugOf(option.name),
    ),
  );

  const improvementLevels = (classId ? levellingFor(classId, rulesVersion)?.improvementLevels : null) ?? [];
  const openLevels = improvementLevels.filter((entry) => entry <= level);

  for (const id of featIds) {
    if (!backgroundFeatId && offeredByBackground.has(id)) {
      backgroundFeatId = id;
      continue;
    }
    const at = openLevels.shift();
    if (at !== undefined) {
      levelChoices[at] = { kind: "feat", featId: id };
      continue;
    }
    if (!freeFeatId) {
      freeFeatId = id;
      continue;
    }
    unresolved.push(`Dote sin lugar donde ponerla: ${id}`);
  }

  /* ---- spells ---- */
  /*
   * `system.prepared` is 0, 1 or 2 — unprepared, prepared, always — and only
   * one class has anywhere to put the 0.
   *
   * A wizard's unprepared spell is one written in the book and not prepared
   * today, so it goes to the book and not to the prepared list; reading them
   * all as prepared would import a wizard with a dozen spells ready to cast
   * and no book at all.
   *
   * For anyone else the state is not kept, because the Forge has no second
   * list to keep it in. They all arrive in the prepared list, where the player
   * can see them and uncheck what they do not want — which is a better place
   * for them than a field no chamber shows. Dropping them outright would be
   * worse still: measured on a real paladin export, 16 of 40 spells sat at 0.
   */
  const usesBook = hasSpellbook(classId);
  const cantrips: string[] = [];
  const spells: string[] = [];
  const book: string[] = [];
  for (const item of items) {
    if (item.type !== "spell" || !item.name) continue;
    const system = item.system as { level?: number; prepared?: number } | undefined;
    const spellLevel = system?.level ?? 0;
    if (spellLevel === 0) {
      cantrips.push(item.name);
      continue;
    }

    const line = `Nv${spellLevel}: ${item.name}`;
    // A spell in the book is on the character either way, so it is written
    // down whether or not it is prepared today.
    if (usesBook) book.push(line);
    if (!usesBook || system?.prepared !== 0) spells.push(line);
  }

  /* ---- gear ---- */
  const weapon = items.find(
    // Every character carries an Unarmed Strike; it is not a weapon anyone
    // chose, and importing it would put it in the Gear chamber as if it were.
    (item) => item.type === "weapon" && item.name && item.name !== "Unarmed Strike",
  );
  const armor = items.find((item) => {
    if (item.type !== "equipment") return false;
    const kind = item.system?.type?.value;
    return kind === "light" || kind === "medium" || kind === "heavy";
  });

  const resolveItem = (item: ActorItem | undefined, label: string): string => {
    if (!item?.name) return "";
    const id = idOf(item);
    const known = optionsFor({ prop: "item", rulesVersion, search: item.name, limit: 40 }).find(
      (option) => option.id === id,
    );
    if (!known) {
      unresolved.push(`${label}: ${item.name}`);
      return "";
    }
    resolved.push(`${label}: ${known.label}`);
    return id;
  };

  const details = (actor.system?.details ?? {}) as Record<string, string>;
  const scores = actor.system?.abilities ?? {};
  const score = (ability: string) => scores[ability]?.value ?? 10;

  const state: BuilderState = {
    ...initialState,
    rulesVersion: rulesVersion === "2024" ? "5e-2024" : "5e-2014",
    createdAt: new Date().toISOString(),
    characterName: actor.name?.trim() || "Sin nombre",
    playerName: "",
    raceId,
    subraceId: "",
    classId,
    subclassId,
    backgroundId,
    backgroundFeatId,
    featId: freeFeatId,
    level,
    statMethod: "roll",

    /*
     * The hit points each level gave, out of the class item. A character
     * levelled at a table that rolls comes back with the numbers they rolled
     * rather than with an average nobody at that table ever used.
     */
    ...hitPointsFromClass(classItem),

    /*
     * Foundry's scores are already final — species bonus, improvements and
     * half-feats all baked in. They are stored here as the base with no
     * bonuses on top, so the derived total matches the sheet the character
     * came from. Seeding a species bonus as well would silently add two to a
     * score the player never raised.
     */
    str: score("str"),
    dex: score("dex"),
    con: score("con"),
    int: score("int"),
    wis: score("wis"),
    cha: score("cha"),
    abilityBonuses: {},

    levelChoices,
    optionalFeatureIds: [],
    featAbilityChoices: {},
    sourceBooks: books,

    weaponId: resolveItem(weapon, "Arma"),
    armorId: resolveItem(armor, "Armadura"),
    extraEquipmentText: "",

    proficienciesText: "",
    languagesText: "",
    cantripsText: cantrips.join("\n"),
    spellsText: spells.join("\n"),
    spellbookText: book.join("\n"),
    featuresText: "",

    alignment: details.alignment ?? "",
    trait: details.trait ?? "",
    ideal: details.ideal ?? "",
    bond: details.bond ?? "",
    flaw: details.flaw ?? "",

    /*
     * The nine description boxes, straight off `system.details`. They are
     * dnd5e's own fields, so a character described in Foundry comes back
     * described here rather than blank.
     */
    age: details.age ?? "",
    height: details.height ?? "",
    weight: details.weight ?? "",
    eyes: details.eyes ?? "",
    hair: details.hair ?? "",
    skin: details.skin ?? "",
    gender: details.gender ?? "",
    faith: details.faith ?? "",
    appearance: details.appearance ?? "",
    notes: "",
  };

  if (cantrips.length + spells.length > 0) {
    resolved.push(`${cantrips.length} trucos y ${spells.length} conjuros`);
  }

  return { state, resolved, unresolved, portrait: portraitOf(actor) };
}
