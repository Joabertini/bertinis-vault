/**
 * Spells granted by something that is not the class: a species, a background,
 * a feat, a warlock's invocation.
 *
 * 5etools keeps all of these in one field, `additionalSpells`, and the builder
 * read it on subclasses only. Measured across the data: 128 subclasses have
 * one, and so do 66 feats, 54 optional features, 50 subspecies, 30 species,
 * 15 backgrounds and 7 classes. None of those 222 reached a character.
 *
 * The gate is a level, but *whose* level depends on what granted it. A
 * subclass counts class levels; a species counts the character's, which is why
 * a tiefling gets its second spell at character level 3 whatever it multiclasses
 * into. The row cannot know, so the caller passes the number it means.
 */

/**
 * A spell as a grant names it: `"faerie fire|xphb"`, read apart.
 *
 * The book is kept because a name is not always unique. The 2024 tiefling is
 * granted `faerie fire|xphb`, and the 2014 spell of that name is a different
 * document; resolving to either at random puts the wrong text on the sheet.
 */
export type GrantedSpellRef = {
  /** Lower case, without the `#c` cantrip marker the data writes. */
  name: string;
  source: string | null;
  /**
   * The level the grant casts it at, where that is above the spell's own.
   *
   * 22 of them, and the 2014 tiefling's Hellish Rebuke is one: it is cast as a
   * 2nd-level spell. Null for everything else, which is nearly all of them.
   */
  castLevel: number | null;
};

/** The ability a granted spell is cast with, when the grant states one. */
export type GrantedSpellAbility = {
  fixed: string | null;
  /** Offered as a choice — the 2024 species offer Intelligence, Wisdom or Charisma. */
  choose: string[];
};

/**
 * Declared here rather than imported: the index package builds this shape and
 * this one reads it, and neither depends on the other. The shapes are checked
 * against each other by the conformance tests, which is where a drift shows.
 */
export type GrantedSpellEntry = {
  kind: "expanded" | "known" | "prepared" | "innate";
  /** The named alternative this belongs to. Null when the grant just applies. */
  variant: string | null;
  ability: GrantedSpellAbility | null;
  /** The level it arrives at, counted in whatever the caller passes. */
  level: number | null;
  /** The *spell* level it arrives with, for the warlock patrons. */
  spellLevel: number | null;
  /** How an innate spell comes back: "daily", "rest", "will", "ritual", "resource". */
  recharge: string | null;
  /** Casts per recharge — the 1 in "1/day". Null when it does not run out. */
  uses: number | null;
  names: GrantedSpellRef[];
  filters: { filter: string; count: number | null }[];
  choices: { from: GrantedSpellRef[]; count: number }[];
};

/**
 * The named alternatives an entity offers, in the order the data lists them.
 *
 * Empty when the grant simply applies. Non-empty means a question the player
 * has to answer before the spells are known — and for two 2024 species it is
 * not only a spell question. XPHB ships no subraces at all, so the elf's Drow,
 * High Elf and Wood Elf, and the tiefling's Abyssal, Chthonic and Infernal,
 * exist nowhere in the data but as names on these blocks. Without reading them
 * a 2024 elf cannot be built.
 */
export function spellVariantsOf(entries: GrantedSpellEntry[] | null | undefined): string[] {
  const seen: string[] = [];

  for (const entry of entries ?? []) {
    if (entry.variant && !seen.includes(entry.variant)) seen.push(entry.variant);
  }

  return seen;
}

/**
 * The entries a character has actually reached.
 *
 * Three gates and they are not interchangeable:
 *
 * - a level, counted in whatever the caller passed
 * - a *spell* level, for the warlock patrons: they arrive when the character's
 *   pact slots reach it, not at a fixed class level, so a level 3 warlock does
 *   not get third-level spells five levels early
 * - a variant, which is a choice rather than a threshold
 *
 * An entry gated by none of them arrives with the thing that granted it.
 *
 * A variant that has not been chosen yields nothing, which is the honest
 * answer: an elf whose lineage is unanswered has no lineage spells, and
 * handing over all three lineages' would be three characters at once.
 */
export function grantedSpellsAt(
  entries: GrantedSpellEntry[] | null | undefined,
  {
    level,
    pactSlotLevel = 0,
    variant = null,
  }: { level: number; pactSlotLevel?: number; variant?: string | null },
): GrantedSpellEntry[] {
  return (entries ?? []).filter((entry) => {
    // A row built before variants were read carries none, and a grant with
    // no alternatives simply applies — both are falsy and both mean "yes".
    if (entry.variant && entry.variant !== variant) return false;
    if (entry.spellLevel !== null) return pactSlotLevel >= entry.spellLevel;
    if (entry.level !== null) return level >= entry.level;
    return true;
  });
}

/**
 * How a granted spell sits on a dnd5e sheet.
 *
 * The four kinds in the data are four rules, and only two of them are about
 * preparation at all:
 *
 * - `known` is on the sheet and castable, which is `prepared`
 * - `innate` is cast without preparing it, so it is prepared too — what makes
 *   it innate is the *method*, and its uses, not the preparation state
 * - `prepared` means always prepared: a cleric's domain spells are ready
 *   without costing one of the day's preparations, which is exactly what
 *   dnd5e's `always` is for
 * - `expanded` grants nothing. It widens the list the character prepares
 *   *from*, and the spell only reaches the sheet if they then prepare it
 */
export function preparationForKind(
  kind: GrantedSpellEntry["kind"],
): "prepared" | "always" | null {
  switch (kind) {
    case "known":
    case "innate":
      return "prepared";
    case "prepared":
      return "always";
    default:
      return null;
  }
}

/**
 * The kinds that widen what a character may prepare, as opposed to grant.
 *
 * One, and it used to be two. `prepared` reads as "always prepared" — a Life
 * Domain cleric has Bless and Cure Wounds ready without spending one of the
 * day's preparations on them — so those spells are handed over rather than
 * offered. Leaving them in the pool as well charged the cleric twice: once in
 * the picker, where they used a preparation, and once as a grant.
 *
 * `expanded` is the other rule and it really is an offer. An Archfey warlock
 * may *learn* Faerie Fire; nothing says they have.
 */
export const PREPARABLE_KINDS: GrantedSpellEntry["kind"][] = ["expanded"];
