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
};

/**
 * "level=0;1|class=Wizard" as something checkable.
 *
 * Four keys appear across all 57 filters in the data: class, level, school and
 * source. An unknown key is kept out rather than guessed at — a filter that
 * silently ignores half of itself offers spells the subclass never granted.
 */
export function parseSpellFilter(filter: string): SpellFilter {
  const parsed: SpellFilter = { classes: [], levels: [], schools: [], sources: [] };

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

