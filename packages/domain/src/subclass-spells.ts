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

export type SubclassSpellEntry = {
  kind: "expanded" | "known" | "prepared" | "innate";
  /** The class level it arrives at, or null when another gate applies. */
  level: number | null;
  /**
   * The *spell* level it arrives with, for the warlock patrons.
   *
   * A warlock gains its patron's expanded spells when its pact slots reach
   * that level, not at a fixed class level. Reading an "s3" as class level 3
   * would hand a level 3 warlock third-level spells five levels early.
   */
  spellLevel: number | null;
  names: string[];
  /** A filter to evaluate, e.g. "level=0|class=Wizard". Null count = all. */
  filters: { filter: string; count: number | null }[];
  /**
   * A choice from a named shortlist rather than from a filter.
   *
   * One subclass states its choice this way, and it is a different rule:
   * there is nothing to evaluate, only a list to pick from.
   */
  choices: { from: string[]; count: number }[];
};

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
 */
export function subclassSpellsAt(
  entries: SubclassSpellEntry[] | null | undefined,
  { classLevel, pactSlotLevel = 0 }: { classLevel: number; pactSlotLevel?: number },
): SubclassSpellEntry[] {
  return (entries ?? []).filter((entry) => {
    if (entry.spellLevel !== null) return pactSlotLevel >= entry.spellLevel;
    if (entry.level !== null) return classLevel >= entry.level;
    return true;
  });
}

/** The kinds that widen what a character may prepare, as opposed to grant. */
export const PREPARABLE_KINDS: SubclassSpellEntry["kind"][] = ["expanded", "prepared"];
