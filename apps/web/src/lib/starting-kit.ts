/**
 * The equipment a character starts with, as something answerable.
 *
 * `startingEquipmentForClass` already turns the index's rows into lines to
 * read. Reading was all a player could do with them: the Forge printed
 * "greataxe **o** un arma marcial cuerpo a cuerpo" and then made them search
 * the 2658-item bag by hand for whichever they picked, retyping their own
 * starting kit.
 *
 * This is the same data shaped as questions with answers. The two editions ask
 * very different ones, and the shape follows the books rather than flattening
 * them:
 *
 * - **2014** asks several small questions — a greataxe or any martial melee, two
 *   handaxes or any simple weapon — and grants an explorer's pack outright.
 * - **2024** asks one big one: take the whole kit, or take the gold.
 *
 * Nothing here is written by hand. Every name, quantity, category and coin
 * amount comes off `startingEquipment.rows`.
 */

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import {
  equipmentCategoryLabel,
  equipmentEntryLine,
  itemInfoFor,
  slugOf,
  startingEquipmentRowsForBackground,
  startingEquipmentRowsForClass,
  type EquipmentRow,
} from "./index-options";

/** An item the kit hands over, already as the id the bag stores. */
export type KitItem = {
  id: string;
  label: string;
  quantity: number;
};

/** A category the player still has to fill, e.g. "un arma marcial". */
export type KitOpenPick = {
  /**
   * The index's own code, e.g. `weaponMartialMelee`, or `"unresolved"` for a
   * name the item list does not carry.
   */
  category: string;
  label: string;
};

export type KitOption = {
  /** The letter the book gives it: `a`/`b` in 2014, `A`/`B` in 2024. */
  key: string;
  /** The whole option said out loud, for the button. */
  label: string;
  items: KitItem[];
  openPicks: KitOpenPick[];
  /** In copper, as the index stores it. Zero for most options. */
  copper: number;
};

export type KitRow = {
  /** Stable across renders and edition changes: `"class:0"`, `"background:1"`. */
  key: string;
  source: "class" | "background";
  /** True when there is nothing to decide and the row is simply granted. */
  granted: boolean;
  options: KitOption[];
};

function toOption(
  option: NonNullable<EquipmentRow["options"]>[number],
  rulesVersion: RulesVersion,
): KitOption {
  const items: KitItem[] = [];
  const openPicks: KitOpenPick[] = [];
  let copper = 0;

  for (const entry of option.entries ?? []) {
    if (entry.kind === "item" && entry.name) {
      const id = slugOf(entry.name);
      /*
       * A name the item list does not carry is a category wearing an item's
       * clothes. 2024 writes "holy symbol" and "druidic focus" as items where
       * 2014 writes them as categories, and neither is a thing anyone owns —
       * what a cleric owns is an Amulet or an Emblem.
       *
       * Treated as an open pick rather than trusted: putting `holy-symbol` in
       * the bag would be a reference to nothing, which is the exact failure the
       * Foundry export exists to avoid. Detected by asking the index rather
       * than by a list of names kept here, so a new one becomes a question
       * instead of a dead line.
       */
      if (itemInfoFor(id, rulesVersion)) {
        items.push({ id, label: entry.displayName ?? entry.name, quantity: entry.quantity ?? 1 });
      } else {
        openPicks.push({ category: "unresolved", label: entry.displayName ?? entry.name });
      }
    } else if (entry.kind === "coins") {
      copper += entry.copper ?? 0;
    } else if (entry.kind === "category") {
      for (const category of entry.categories ?? []) {
        openPicks.push({ category, label: equipmentCategoryLabel(category) });
      }
    }
    // `special` is prose the index could not resolve to an item — it shows in
    // the label and is deliberately not turned into a bag entry, because a
    // made-up id is worse than a line the player reads and handles.
  }

  const label =
    (option.entries ?? [])
      .map((entry) => equipmentEntryLine(entry))
      .filter(Boolean)
      .join(", ") || "nada";

  // The 2014 rows letter their options and the 2024 rows do too, but the type
  // allows a row without one. An unlettered option is still an answer, so it
  // gets a positional key rather than being dropped.
  return { key: option.key ?? "_", label, items, openPicks, copper };
}

function toRows(
  rows: EquipmentRow[],
  source: KitRow["source"],
  rulesVersion: RulesVersion,
): KitRow[] {
  return rows.map((row, index) => ({
    key: `${source}:${index}`,
    source,
    // A row the book does not letter is a grant. Asking a player to confirm the
    // only answer is not a choice, it is a click.
    granted: row.fixed !== false || (row.options ?? []).length < 2,
    options: (row.options ?? []).map((option) => toOption(option, rulesVersion)),
  }));
}

/** Every row the class and the background contribute, class first. */
export function startingKitFor(
  classId: string,
  backgroundId: string,
  rulesVersion: RulesVersion,
  sourceBooks: Record<string, string> = {},
): KitRow[] {
  const fromClass = classId ? startingEquipmentRowsForClass(classId, rulesVersion) : [];
  const fromBackground = backgroundId
    ? startingEquipmentRowsForBackground(
        backgroundId,
        rulesVersion,
        sourceBooks[`background:${backgroundId}`] ?? sourceBooks.background,
      )
    : [];

  return [
    ...toRows(fromClass, "class", rulesVersion),
    ...toRows(fromBackground, "background", rulesVersion),
  ];
}

/**
 * The bag lines an answered kit produces.
 *
 * A quantity becomes repeated ids rather than a count, because that is what the
 * bag already stores and what the export already resolves. Four handaxes are
 * four lines.
 */
export function kitItemIds(option: KitOption): string[] {
  return option.items.flatMap((item) => Array.from({ length: item.quantity }, () => item.id));
}

/** What a granted row hands over without being asked. */
export function grantedOptions(rows: KitRow[]): KitOption[] {
  return rows.filter((row) => row.granted).flatMap((row) => row.options);
}

/**
 * The coins the answered kit is worth, in copper.
 *
 * Reported, not exported: `ImportPayload` has no currency field, so this cannot
 * cross to Foundry yet. Showing it anyway is the point — a 2024 barbarian who
 * takes option B is choosing 75 gold over a greataxe, and a builder that hides
 * the number is asking them to choose blind.
 */
export function kitCopper(options: KitOption[]): number {
  return options.reduce((sum, option) => sum + option.copper, 0);
}

/** Copper as a table says it: "75 po", or "15 po 5 pc" when it does not divide. */
export function coinLabel(copper: number): string {
  if (copper <= 0) return "";
  const gold = Math.floor(copper / 100);
  const rest = copper % 100;
  if (!gold) return `${rest} pc`;
  return rest ? `${gold} po ${rest} pc` : `${gold} po`;
}
