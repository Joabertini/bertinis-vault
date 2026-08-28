import { grantedSpellsAt, type GrantedSpellEntry } from "./granted-spells.js";

/**
 * The spells a subclass adds, and when.
 *
 * For most subclasses this is the domain, circle or oath list on top of the
 * class's own. For two it is the *entire* list: the fighter and the rogue have
 * no spells, so an Eldritch Knight and an Arcane Trickster were offered
 * nothing at all — in a builder that let you pick the subclass and set a
 * casting ability. Their list is the wizard's, and the subclass is the only
 * place that says so.
 *
 * Four kinds appear and they are four rules, not four spellings:
 *
 * - `prepared` and `expanded` join the list the character prepares from
 * - `known` is known without costing anything on the sheet
 * - `innate` is cast without preparing it, usually once a day
 *
 * A spell is either named or described by a filter — "every wizard cantrip".
 * The filter stays a filter in the index, because expanding it needs the spell
 * list and baking 300 names into a subclass row would be large and stale.
 */

/**
 * What a subclass grants, which is the same shape everything else grants.
 *
 * Kept as a name because that is what the subclass rows call it, and because
 * the gate a subclass states is a *class* level where a species states the
 * character's.
 */
export type SubclassSpellEntry = GrantedSpellEntry;
/** What a 5etools spell filter asks for. Absent means "anything". */
export type SpellFilter = {
  classes: string[];
  levels: number[];
  schools: string[];
  sources: string[];
  /**
   * Whether the spell must be castable as a ritual.
   *
   * Null when the filter does not ask. Fourteen do, and Ritual Caster is why:
   * "a 1st-level spell from that class's spell list **that has the ritual
   * tag**". Dropped, the filter reads as "a 1st-level bard spell" and offers
   * a hundred where the feat grants a choice of ten.
   */
  ritual: boolean | null;
  /**
   * The attack rolls the spell may need: `"m"` melee, `"r"` ranged.
   *
   * Empty when the filter does not ask. One feat does — Spell Sniper grants
   * "a cantrip that requires an attack roll" — and it asks for all of them,
   * which is the same as asking for any.
   */
  attacks: string[];
};

/**
 * "level=0;1|class=Wizard" as something checkable.
 *
 * Six keys appear across the 227 filters in the data. Four were read and two
 * were dropped in silence, which is worse than not reading them: a filter that
 * ignores half of itself offers spells the thing never granted. Ritual Caster
 * asked for "a 1st-level spell with the ritual tag" and was served every
 * 1st-level spell of the class.
 *
 * An unknown key still yields nothing rather than a guess. The key match is
 * case-insensitive because the data is not consistent about it — one filter
 * writes `Components & Miscellaneous` and thirteen write it lower case.
 */
export function parseSpellFilter(filter: string): SpellFilter {
  const parsed: SpellFilter = {
    classes: [],
    levels: [],
    schools: [],
    sources: [],
    ritual: null,
    attacks: [],
  };

  for (const clause of filter.split("|")) {
    const [key, values] = clause.split("=");
    if (!key || !values) continue;
    const parts = values.split(";").map((value) => value.trim()).filter(Boolean);

    switch (key.trim().toLowerCase()) {
      case "class":
        parsed.classes.push(...parts);
        break;
      case "level":
        parsed.levels.push(...parts.map(Number).filter(Number.isFinite));
        break;
      case "school":
        parsed.schools.push(...parts);
        break;
      case "source":
        parsed.sources.push(...parts);
        break;
      case "components & miscellaneous":
        // The only value that appears is "ritual". Anything else here is a
        // component or a tag nothing asks about yet, and is left unread rather
        // than turned into a constraint that was never stated.
        if (parts.some((part) => same(part, "ritual"))) parsed.ritual = true;
        break;
      case "spell attack":
        parsed.attacks.push(...parts.map((part) => part.toLowerCase()));
        break;
    }
  }

  return parsed;
}

export type FilterableSpell = {
  name: string;
  level: number;
  school?: string | null;
  source: string;
  /** "Wizard|PHB" entries, as the index stores them. */
  classes: string[];
  /** Whether it can be cast as a ritual. */
  ritual?: number | boolean | null;
  /** The attack rolls it needs: `"m"`, `"r"`. */
  attack?: string[] | null;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether a spell is what a filter describes.
 *
 * The class match ignores the book: "class=Wizard" means the wizard list,
 * and a spell on the 2024 wizard's list is on the wizard's list.
 */
export function spellMatchesFilter(spell: FilterableSpell, filter: SpellFilter): boolean {
  if (filter.levels.length && !filter.levels.includes(spell.level)) return false;
  if (filter.sources.length && !filter.sources.some((source) => same(source, spell.source))) {
    return false;
  }
  if (filter.schools.length && !filter.schools.some((school) => same(school, spell.school ?? ""))) {
    return false;
  }
  if (filter.ritual !== null && Boolean(spell.ritual) !== filter.ritual) return false;
  /*
   * "m;r;o" asks for any attack roll, so any of the listed kinds matching is
   * a match. A spell with no attack at all never matches an asking filter.
   */
  if (filter.attacks.length) {
    const kinds = (spell.attack ?? []).map((kind) => kind.toLowerCase());
    if (!kinds.some((kind) => filter.attacks.includes(kind))) return false;
  }
  if (filter.classes.length) {
    const names = spell.classes.map((entry) => entry.split("|")[0] ?? "");
    if (!filter.classes.some((wanted) => names.some((name) => same(name, wanted)))) return false;
  }

  return true;
}

/**
 * The entries a character has actually reached.
 *
 * Two gates, and they are not interchangeable. Most subclasses state a class
 * level. The warlock patrons state a spell level, which is reached when the
 * character's pact slots get there — so the caller passes what its slots are
 * worth, and a warlock with no pact slots reaches none of them.
 *
 * An entry gated by neither arrives with the subclass itself.
 *
 * Six subclasses state a third gate — Circle of the Land's terrain, the
 * Genie's four patrons — where the choice is a name and not a threshold.
 */
export function subclassSpellsAt(
  entries: SubclassSpellEntry[] | null | undefined,
  {
    classLevel,
    pactSlotLevel = 0,
    variant = null,
  }: { classLevel: number; pactSlotLevel?: number; variant?: string | null },
): SubclassSpellEntry[] {
  return grantedSpellsAt(entries, { level: classLevel, pactSlotLevel, variant });
}

