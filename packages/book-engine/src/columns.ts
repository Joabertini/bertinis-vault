import { groupLines } from "./lines.js";
import type { PageText, TextItem } from "./text-model.js";

const BINS = 200;

/**
 * Split a page into columns. A column break is a vertical band, in the middle
 * of the page, that no run of text crosses. Runs wider than 60 % of the page
 * (titles, full-width tables) are left out of the count, so one banner does
 * not hide the gutter below it.
 */
export function splitColumns(items: readonly TextItem[], pageWidth: number): TextItem[][] {
  if (items.length === 0 || pageWidth <= 0) return [[...items]];

  const covered = new Array<number>(BINS).fill(0);
  for (const it of items) {
    if (it.w > pageWidth * 0.6) continue;
    const a = Math.max(0, Math.floor((it.x / pageWidth) * BINS));
    const b = Math.min(BINS - 1, Math.floor(((it.x + it.w) / pageWidth) * BINS));
    for (let i = a; i <= b; i++) covered[i] = (covered[i] ?? 0) + 1;
  }

  const lo = Math.floor(BINS * 0.12);
  const hi = Math.ceil(BINS * 0.88);
  const cuts: number[] = [];
  let i = lo;
  while (i < hi) {
    if ((covered[i] ?? 0) === 0) {
      let j = i;
      while (j < hi && (covered[j] ?? 0) === 0) j++;
      if (j - i >= 3) cuts.push((((i + j) / 2) / BINS) * pageWidth);
      i = j;
    } else {
      i++;
    }
  }
  if (cuts.length === 0) return [[...items]];

  const cols: TextItem[][] = Array.from({ length: cuts.length + 1 }, () => []);
  for (const it of items) {
    const center = it.x + it.w / 2;
    let k = 0;
    while (k < cuts.length && center > (cuts[k] ?? Infinity)) k++;
    cols[k]?.push(it);
  }
  return cols.filter((c) => c.length > 0);
}

/**
 * The text of a page. With `columns` on, each column is read top to bottom
 * and the columns one after the other; off, lines run across the whole page,
 * which is what a plain text extraction gives and mixes columns together.
 */
export function pageToText(page: PageText, columns: boolean): string {
  const groups = columns ? splitColumns(page.items, page.width) : [page.items];
  return groups
    .map((g) =>
      groupLines(g)
        .map((l) => l.text)
        .join("\n"),
    )
    .join("\n\n");
}
