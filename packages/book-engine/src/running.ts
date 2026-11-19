import { groupRows, rowText } from "./lines.js";
import { fold } from "./normalize.js";
import type { PageText, TextItem } from "./text-model.js";

const BAND = 0.08;

/** A row with its digits replaced, so "CHAPTER 4 | 149" and "... | 150" match. */
const keyOf = (text: string): string => fold(text).replace(/\d+/g, "#");

function inBand(row: readonly TextItem[], height: number): boolean {
  const y = row[0]?.y ?? 0;
  return y >= height * (1 - BAND) || y <= height * BAND;
}

/**
 * The running heads and feet of a book: rows in the top or bottom 8 % of the
 * page whose text (digits aside) repeats on at least a fifth of the pages,
 * and at least three. Page numbers are the plainest case ("#").
 */
export function findRunningKeys(pages: readonly PageText[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const row of groupRows(p.items)) {
      if (!inBand(row, p.height)) continue;
      const key = keyOf(rowText(row));
      if (key.length > 0) seen.add(key);
    }
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const need = Math.max(3, Math.ceil(pages.length * 0.2));
  const keys = new Set<string>();
  for (const [k, n] of counts) if (n >= need) keys.add(k);
  return keys;
}

/** The items of a page without its running rows, and how many rows went. */
export function dropRunning(
  page: PageText,
  keys: ReadonlySet<string>,
): { items: TextItem[]; dropped: number } {
  if (keys.size === 0) return { items: page.items, dropped: 0 };
  const items: TextItem[] = [];
  let dropped = 0;
  for (const row of groupRows(page.items)) {
    if (inBand(row, page.height) && keys.has(keyOf(rowText(row)))) {
      dropped++;
      continue;
    }
    items.push(...row);
  }
  return { items, dropped };
}
