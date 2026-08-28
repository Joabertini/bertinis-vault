/**
 * The cheat sheet, narrowed to one character.
 *
 * The original is a reference: pick your class from twelve, read its notes.
 * A sealed character already answers that question and four more — which
 * subclass, which feats, which level, which numbers — so none of it needs
 * asking again. What the tome shows is the same prose with everything that
 * does not apply already gone.
 *
 * The numbers the cheat sheet never had are joined on here: attack bonus,
 * save DC, armour class, hit points. Those come from the derived build, which
 * is the same object the Foundry export sends, so a tome and an export can
 * never disagree.
 *
 * Nothing is invented. Where the sheet has no note for a class — Artificer,
 * and the sidekick classes — the section is absent rather than filled with a
 * general remark, because a general remark is what a player skips.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "./builder";
import { characterLevelFor } from "./builder";
import { entryById } from "./catalog";
import { modifierOf, primaryAbilityOf, signed } from "./counsel";
import { slugOf } from "./index-options";
import {
  CLASS_NOTES,
  COMBO_NOTES,
  FEAT_NOTES,
  UNIVERSAL_RULES,
  type ClassNotes,
  type ComboNote,
  type FeatNote,
  type PlayNote,
  type RuleBlock,
  type SubclassNotes,
} from "./playbook-data";

export type { PlayNote, ComboNote, FeatNote, RuleBlock };

/**
 * The three tabs the Vision is read in.
 *
 * `core` is what is true before the fight starts and stays true through it:
 * the character's numbers, the shape of a turn, the rules that apply whether
 * or not anyone is swinging. `combate` is what gets spent to hurt or help.
 * `movimiento` is moving, and what moving provokes.
 */
export type VisionTab = "core" | "combate" | "movimiento";

/*
 * Movement, as the cheat sheet writes about it.
 *
 * The sheet has no tab field — it was written as one long page — so the split
 * is inferred from the prose. Three rules were needed to make that honest,
 * and each one came from a note it was putting in the wrong place.
 *
 * It matches movement *verbs* and the opportunity-attack trigger, not
 * distances. Matching "alcance" and "10ft" pulled in the Echo Knight and the
 * Psi Warrior, whose notes name a range and have nothing to do with moving.
 *
 * "velocidad" is deliberately absent. It appears most often as one rider in a
 * list of four — Bladesong's "+INT a CA, +10ft velocidad, ventaja Acrobacia",
 * the Transmuter's Stone — where the note is a combat buff that happens to
 * mention speed. The abilities that really are about moving say so another
 * way too: Mobile names Dash, Sentinel names the opportunity attack.
 *
 * And nothing is ever dropped: whatever this does not claim goes to `combate`,
 * which is where a class feature belongs by default. The conformance probe
 * pins the count in each tab, so a silent reshuffle shows up as a failure
 * rather than as a quietly emptier page.
 */
const MOVEMENT = new RegExp(
  [
    "oportunidad", // "Ataque de oportunidad" — 8 of the 14 reactions
    "\\bAoO\\b",
    "disengage",
    "deseng", // "Desengancharse"
    "dash",
    "moverse",
    "movimiento",
    "alejar", // covers "alejarse"
    "acercar", // covers "acercarse"
    "empuj", // forced movement
    "derrib",
    "prono",
    "salir de tu alcance", // the opportunity-attack trigger, spelled out
  ].join("|"),
  "i",
);

/**
 * Which tab a class or subclass note belongs on.
 *
 * Name and description only. See `tabForFeat` for why the tip is left out.
 */
export function tabForNote(note: PlayNote): VisionTab {
  return MOVEMENT.test(`${note.name} ${note.desc}`) ? "movimiento" : "combate";
}

/**
 * Which tab a feat belongs on.
 *
 * A passive feat is true all the time and so belongs with the other things
 * that are always true — unless what it is passively doing is about moving,
 * which is exactly Mobile.
 *
 * The `tip` is not read here, and that is the whole point of this comment.
 * Tips are cross-references — War Caster's says "Sentinel + War Caster =
 * podés lanzar Shocking Grasp como AoO", Martial Adept's names Trip Attack —
 * so testing them files a feat under another feat's subject. War Caster is
 * about holding concentration; it was landing on the movement tab because of
 * a sentence about someone else.
 */
export function tabForFeat(name: string, note: FeatNote): VisionTab {
  if (MOVEMENT.test(`${name} ${note.desc}`)) return "movimiento";
  return note.category === "passive" ? "core" : "combate";
}

/**
 * Which tab a universal rule belongs on.
 *
 * These are the two blocks every character sees. The turn structure is core
 * by definition — it is the frame the other two tabs sit inside — except its
 * own MOVIMIENTO line, which is the one thing on this page that is literally
 * about moving.
 */
export function tabForRule(label: string): VisionTab {
  if (MOVEMENT.test(label)) return "movimiento";
  return "core";
}

/** One number a player reads off the sheet mid-turn. */
export type Vital = {
  label: string;
  value: string;
  /** Where the number comes from. Short enough to sit under it. */
  from?: string;
};

export type Playbook = {
  /** The numbers the cheat sheet never carried. */
  vitals: Vital[];
  role: string | null;
  icon: string | null;
  /** Only where the sheet says this class is hard to play. */
  warnings: string[];
  bonusActions: PlayNote[];
  reactions: PlayNote[];
  features: PlayNote[];
  /** The class tip, then the subclass tip, in that order. */
  tips: string[];
  /** The character's own feats, with the sheet's note for each. */
  feats: Array<{ name: string; note: FeatNote }>;
  /** Only the combinations this character actually assembles. */
  combos: ComboNote[];
  /** The turn structure and the rules everyone forgets. Always shown. */
  rules: RuleBlock[];
  /** True when the sheet has nothing written for this class. */
  unwritten: boolean;
};

/*
 * The sheet keys its subclasses the way a player says them — "Berserker",
 * "Evocation", "Life" — and the index stores the printed name. The printed
 * name wraps the spoken one on either side depending on the class: the
 * barbarian gets "Path of the Berserker" and the wizard "School of
 * Evocation", but the cleric gets "Life Domain". Matching both ends joins
 * 100 of the 101.
 *
 * The comparison is word-bounded on purpose. A bare `includes` would let a
 * spoken "Life" match a printed "Lifedrinker", and a subclass quietly showing
 * another subclass's notes is worse than showing none.
 *
 * Only one subclass is not a wrapping at all: the 2014 fighter's Purple
 * Dragon Knight, which later books reprint as Banneret. Keyed by the printed
 * name, because that is the side the index gives us.
 */
const SUBCLASS_ALIASES: Record<string, string> = {
  banneret: "purple dragon knight",
};

/**
 * The feats a character took, named the way the cheat sheet names them.
 *
 * Matched against the sheet's own keys rather than through the index. The
 * keys are the printed English names, so slugging them lands on exactly the
 * ids a build stores, and the join can only produce feats that actually have
 * a note — a feat the sheet never covered drops out here instead of arriving
 * downstream as an entry with nothing to say.
 *
 * Resilient is the awkward one: one feat pointed at an ability, and the sheet
 * only writes up the Constitution version because that is the one anyone
 * takes. So it counts only when Constitution is what it was pointed at.
 */
export function featNamesOf(state: BuilderState): string[] {
  const byId = new Map<string, string>();
  for (const name of Object.keys(FEAT_NOTES)) byId.set(slugOf(name), name);

  const featIds = [
    ...Object.values(state.levelChoices)
      .filter((choice) => choice.kind === "feat")
      .map((choice) => choice.featId),
    state.featId,
    state.backgroundFeatId,
  ].filter(Boolean);

  const names: string[] = [];
  for (const id of featIds) {
    if (id === "resilient") {
      if ((state.featAbilityChoices.resilient?.con ?? 0) > 0) names.push("Resilient (CON)");
      continue;
    }
    const name = byId.get(id);
    if (name) names.push(name);
  }

  return [...new Set(names)];
}

/** Every combination this character's class, subclass and feats add up to. */
function combosFor(classes: string[], subclasses: string[], feats: string[]): ComboNote[] {
  const has = (name: string) => feats.includes(name);
  const isClass = (name: string) => classes.includes(name);
  const isSub = (fragment: string) =>
    subclasses.some((entry) => entry.toLowerCase().includes(fragment));

  /*
   * The cheat sheet's own predicates, rewritten as functions because a
   * function cannot be serialised out of the generated data. Each one is the
   * original condition unchanged — this is a port, not a reinterpretation.
   */
  const applies: Record<string, () => boolean> = {
    sorlock: () => isClass("sorcerer") && isClass("warlock"),
    hexadin: () => isClass("paladin") && (isClass("warlock") || isSub("hexblade")),
    gwm_reckless: () => isClass("barbarian") && has("Great Weapon Master"),
    gwm_action_surge: () => isClass("fighter") && has("Great Weapon Master"),
    sharpshooter_archery: () =>
      (isClass("fighter") || isClass("ranger")) && has("Sharpshooter"),
    cbex_sharpshooter: () => has("Crossbow Expert") && has("Sharpshooter"),
    pam_sentinel: () => has("Polearm Master") && has("Sentinel"),
    warcaster_sentinel: () => has("War Caster") && has("Sentinel"),
    smite_gwm: () => isClass("paladin") && has("Great Weapon Master"),
    lucky_champion: () => isClass("fighter") && has("Lucky") && isSub("champion"),
    mobile_rogue: () => isClass("rogue") && has("Mobile"),
    shield_master_attack: () => has("Shield Master"),
    resilient_warcaster: () => has("Resilient (CON)") && has("War Caster"),
    inspiring_bard: () => (isClass("bard") || isClass("paladin")) && has("Inspiring Leader"),
  };

  return COMBO_NOTES.filter((combo) => applies[combo.id]?.() ?? false);
}

/** The subclass notes, matched across the two naming conventions. */
function subclassNotesFor(notes: ClassNotes, subclassLabel: string | null): SubclassNotes | null {
  if (!subclassLabel) return null;

  const raw = subclassLabel.toLowerCase().trim();
  const printed = SUBCLASS_ALIASES[raw] ?? raw;

  for (const [key, value] of Object.entries(notes.subclasses)) {
    const spoken = key.toLowerCase().trim();
    if (
      printed === spoken ||
      printed.endsWith(` ${spoken}`) || // "path of the berserker"
      printed.startsWith(`${spoken} `) // "life domain"
    ) {
      return value;
    }
  }

  return null;
}

export function playbookFor(
  state: BuilderState,
  snapshot: CharacterBuild | null,
  rulesVersion: RulesVersion,
): Playbook {
  const notes = CLASS_NOTES[state.classId] ?? null;
  const subclass = entryById(
    "subclass",
    rulesVersion,
    state.subclassId,
    state.sourceBooks[`subclass:${state.subclassId}`],
  );
  const subNotes = notes ? subclassNotesFor(notes, subclass?.label ?? null) : null;

  const feats = featNamesOf(state);

  return {
    vitals: vitalsOf(state, snapshot, rulesVersion),
    role: notes?.role ?? null,
    icon: notes?.icon ?? null,
    warnings: notes?.difficultyWarnings ?? [],
    bonusActions: notes?.bonusActions ?? [],
    reactions: notes?.reactions ?? [],
    // The subclass's own features come after the class's, which is the order
    // a character gains them.
    features: [...(notes?.classFeatures ?? []), ...(subNotes?.extra ?? [])],
    tips: [notes?.forgottenTip, subNotes?.forgottenTip].filter((tip): tip is string =>
      Boolean(tip),
    ),
    feats: feats
      .map((name) => ({ name, note: FEAT_NOTES[name] }))
      .filter((entry): entry is { name: string; note: FeatNote } => Boolean(entry.note)),
    combos: combosFor([state.classId], [subclass?.label ?? ""], feats),
    rules: UNIVERSAL_RULES,
    unwritten: notes === null,
  };
}

/**
 * The numbers, stated the way a character sheet states them.
 *
 * The cheat sheet was written to be printed once and read at every table, so
 * it could not carry any of these. A tome belongs to one character and can.
 */
function vitalsOf(
  state: BuilderState,
  snapshot: CharacterBuild | null,
  rulesVersion: RulesVersion,
): Vital[] {
  if (!snapshot) return [];

  const vitals: Vital[] = [];
  const prof = snapshot.derived.proficiencyBonus;
  const primary = primaryAbilityOf(state, rulesVersion);

  if (primary) {
    const mod = modifierOf(snapshot.abilities.final[primary.ability]);
    vitals.push({
      label: primary.source === "conjuros" ? "Ataque de conjuro" : "Al ataque",
      value: signed(prof + mod),
      from: `competencia ${signed(prof)} + ${primary.ability.toUpperCase()} ${signed(mod)}`,
    });
  }

  const spellcasting = snapshot.derived.spellcasting;
  if (spellcasting) {
    vitals.push({
      label: "CD de salvacion",
      value: `${spellcasting.saveDC}`,
      from: "lo que tus enemigos tienen que superar",
    });
  }

  vitals.push(
    { label: "CA", value: `${snapshot.derived.ac}`, from: "lo protegido que estas" },
    { label: "PG", value: `${snapshot.derived.hp}`, from: "lo que aguantas antes de caer" },
    { label: "Competencia", value: signed(prof), from: `nivel ${characterLevelFor(state)}` },
  );

  return vitals;
}
