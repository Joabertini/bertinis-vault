/**
 * Turning a starting-equipment list into the things a character owns.
 *
 * The list is a set of questions — "(a) a rapier or (b) a shortsword" — and
 * this module is what happens once they are answered. Three things make it
 * more than a lookup:
 *
 * - a row can be granted outright, in which case there is nothing to answer
 * - an option can hand over a *category* ("any simple weapon"), which is a
 *   second question the player still owes an answer to
 * - money arrives three ways: as coins inside an option, as a pouch's
 *   contents, and as 2014's "take 4d4 × 10 gp instead of the whole list"
 *
 * Everything is counted in copper because that is what the data counts in.
 * Converting to gold on the way in loses the 2024 lists that hand out silver.
 */

/** One thing an option hands over. Mirrors the index's own shape. */
export type StartingEquipmentEntry =
  | { kind: "item"; name: string; source?: string | null; quantity?: number; displayName?: string }
  | { kind: "category"; categories: string[]; quantity?: number }
  | { kind: "coins"; copper: number }
  | { kind: "special"; label: string; quantity?: number };

export type StartingEquipmentRow = {
  fixed: boolean;
  options: { key: string; entries: StartingEquipmentEntry[] }[];
};

export type StartingEquipmentList = {
  /** Which list this is, so an answer can name the row it answers. */
  id: string;
  rows: StartingEquipmentRow[];
  goldAlternative?: string | null;
};

/** An item the character ends up with. */
export type ResolvedItem = {
  name: string;
  source: string | null;
  quantity: number;
  /** What to show. The display name when the data renames the item. */
  label: string;
};

/** A category the player still has to turn into an item. */
export type OpenCategory = {
  /** Which row it came from, so the interface can put the question in place. */
  rowId: string;
  categories: string[];
  quantity: number;
};

export type ResolvedStartingEquipment = {
  items: ResolvedItem[];
  /** Everything the character starts with, in copper. */
  copper: number;
  /** Things with no item to point at — the wizard's spellbook, a diary. */
  specials: { label: string; quantity: number }[];
  /** Categories the player has not turned into items yet. */
  openCategories: OpenCategory[];
  /** Rows that are a choice and have no answer. */
  unanswered: string[];
};

/** The id an answer uses to name one row of one list. */
export function equipmentRowId(listId: string, index: number): string {
  return `${listId}:${index}`;
}

const quantityOf = (entry: { quantity?: number }): number => entry.quantity ?? 1;

const EMPTY: ResolvedStartingEquipment = {
  items: [],
  copper: 0,
  specials: [],
  openCategories: [],
  unanswered: [],
};

/**
 * The whole list, given the answers.
 *
 * `answers` maps a row id to the option key the player picked. A row that is
 * fixed needs no answer and is never reported as unanswered; a row that is a
 * choice and has none contributes nothing but says so, because half a list is
 * worse than a list that admits it is incomplete.
 *
 * `takeGold` is 2014's alternative, and it replaces every list rather than one
 * row. The caller rolls the formula; this only says the list is off.
 */
export function resolveStartingEquipment({
  lists,
  answers,
  takeGold = false,
  goldCopper = 0,
}: {
  lists: StartingEquipmentList[];
  answers: Record<string, string>;
  /** Take the money instead of the equipment, which is a 2014 rule. */
  takeGold?: boolean;
  /** What the gold formula rolled, in copper, when `takeGold` is set. */
  goldCopper?: number;
}): ResolvedStartingEquipment {
  if (takeGold) return { ...EMPTY, copper: goldCopper };

  const result: ResolvedStartingEquipment = {
    items: [],
    copper: 0,
    specials: [],
    openCategories: [],
    unanswered: [],
  };

  for (const list of lists) {
    for (const [index, row] of list.rows.entries()) {
      const rowId = equipmentRowId(list.id, index);
      const option = row.fixed
        ? row.options[0]
        : row.options.find((candidate) => candidate.key === answers[rowId]);

      if (!option) {
        if (!row.fixed) result.unanswered.push(rowId);
        continue;
      }

      for (const entry of option.entries) {
        switch (entry.kind) {
          case "item":
            addItem(result.items, {
              name: entry.name,
              source: entry.source ?? null,
              quantity: quantityOf(entry),
              label: entry.displayName ?? entry.name,
            });
            break;
          case "coins":
            result.copper += entry.copper;
            break;
          case "category":
            result.openCategories.push({
              rowId,
              categories: entry.categories,
              quantity: quantityOf(entry),
            });
            break;
          case "special":
            result.specials.push({ label: entry.label, quantity: quantityOf(entry) });
            break;
        }
      }
    }
  }

  return result;
}

/**
 * Two of the same item is one line with a quantity of two.
 *
 * A rogue who takes the shortsword twice — once for the rapier row and once
 * instead of the bow — owns two shortswords, not one listed twice.
 */
function addItem(items: ResolvedItem[], item: ResolvedItem): void {
  const existing = items.find(
    (candidate) => candidate.name === item.name && candidate.source === item.source,
  );
  if (existing) {
    existing.quantity += item.quantity;
    return;
  }
  items.push({ ...item });
}

/** Copper as the four coins a sheet shows, largest first. */
export function coinsFromCopper(copper: number): {
  gp: number;
  sp: number;
  cp: number;
} {
  const gp = Math.floor(copper / 100);
  const sp = Math.floor((copper % 100) / 10);
  return { gp, sp, cp: copper % 10 };
}

/**
 * The average of a starting-gold formula, for showing what taking it is worth.
 *
 * "4d4 × 10" averages 100 gp. The books mean this as a roll, so a build that
 * takes the money should roll it — but a number has to be shown before the
 * player commits, and the average is the honest one to show.
 */
export function averageStartingGold(formula: string): number | null {
  const match = /^(\d+)d(\d+)(?:\s*×\s*(\d+))?$/.exec(formula.trim());
  if (!match) return null;

  const [, countRaw, facesRaw, multiplierRaw] = match;
  const count = Number(countRaw);
  const faces = Number(facesRaw);
  const multiplier = multiplierRaw ? Number(multiplierRaw) : 1;

  return (count * (faces + 1)) / 2 * multiplier;
}
