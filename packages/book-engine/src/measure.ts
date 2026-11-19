import { pageToText, splitColumns } from "./columns.js";
import { indexPages, locate, type MatchKind } from "./match.js";
import { measureNoise, type NoiseStats } from "./noise.js";
import type { RefEntry } from "./reference.js";
import type { PageText } from "./text-model.js";

export interface BookReport {
  columns: boolean;
  pages: number;
  /** Pages with fewer than 20 characters of text. */
  emptyPages: number;
  /** Mean columns found per page that has text. */
  meanColumns: number;
  noise: NoiseStats;
  refs: number;
  found: { exact: number; squash: number; fuzzy: number; missing: number };
  /** Share of references found by any kind of match (0..1). */
  recall: number;
  /** Share found by exact match only (0..1). */
  recallExact: number;
  /** File page minus printed page, the most common one among exact hits. */
  pageOffset: number | null;
  /** Refs with a printed page that were found within one page of where the data says. */
  pageConsistent: { checked: number; ok: number; rate: number };
  /** Names not found, to read by eye. */
  missing: string[];
}

export interface MeasureOptions {
  columns: boolean;
  vocabulary?: ReadonlySet<string>;
  /** Replaces the plain page text: the cleaned text of P1. */
  reader?: (pages: readonly PageText[]) => { page: number; text: string }[];
}

/**
 * P0: how much of a book's known content survives plain text extraction.
 *
 * It takes entries the data already knows (spell names of this book) and asks,
 * for each: is it on a page of the extracted text? With the strict match,
 * with spaces and punctuation ignored, or with a few wrong letters. The gap
 * between those three is the cleaning work the engine has to do (P1).
 */
export function measureBook(
  pages: readonly PageText[],
  refs: readonly RefEntry[],
  options: MeasureOptions,
): BookReport {
  const texts = options.reader
    ? options.reader(pages)
    : pages.map((p) => ({ page: p.page, text: pageToText(p, options.columns) }));
  const withText = texts.filter((t) => t.text.length >= 20).length;

  let columnCount = 0;
  let columnPages = 0;
  for (const p of pages) {
    if (p.items.length === 0) continue;
    columnCount += splitColumns(p.items, p.width).length;
    columnPages++;
  }

  const index = indexPages(texts);
  const found: Record<MatchKind | "missing", number> = { exact: 0, squash: 0, fuzzy: 0, missing: 0 };
  const locations = refs.map((r) => ({ ref: r, loc: locate(r.name, index) }));
  const missing: string[] = [];
  for (const { ref, loc } of locations) {
    if (loc.kind === null) {
      found.missing++;
      missing.push(ref.name);
    } else {
      found[loc.kind]++;
    }
  }

  // The printed page number is not the file page: find the usual distance.
  const votes = new Map<number, number>();
  for (const { ref, loc } of locations) {
    if (loc.kind !== "exact" || ref.page === null) continue;
    for (const p of loc.pages) votes.set(p - ref.page, (votes.get(p - ref.page) ?? 0) + 1);
  }
  let pageOffset: number | null = null;
  let best = 0;
  for (const [offset, n] of votes) {
    if (n > best) {
      best = n;
      pageOffset = offset;
    }
  }

  let checked = 0;
  let ok = 0;
  if (pageOffset !== null) {
    for (const { ref, loc } of locations) {
      if (ref.page === null || loc.kind === null) continue;
      checked++;
      const want = ref.page + pageOffset;
      if (loc.pages.some((p) => Math.abs(p - want) <= 1)) ok++;
    }
  }

  const total = refs.length;
  const all = texts.map((t) => t.text).join("\n");
  return {
    columns: options.columns,
    pages: pages.length,
    emptyPages: pages.length - withText,
    meanColumns: columnPages > 0 ? columnCount / columnPages : 0,
    noise: measureNoise(all, options.vocabulary),
    refs: total,
    found: { exact: found.exact, squash: found.squash, fuzzy: found.fuzzy, missing: found.missing },
    recall: total > 0 ? (total - found.missing) / total : 0,
    recallExact: total > 0 ? found.exact / total : 0,
    pageOffset,
    pageConsistent: { checked, ok, rate: checked > 0 ? ok / checked : 0 },
    missing,
  };
}
