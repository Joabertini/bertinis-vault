import { editDistance, fold, squash } from "./normalize.js";

export type MatchKind = "exact" | "squash" | "fuzzy";

export interface PageIndex {
  page: number;
  folded: string;
  squashed: string;
  /** Folded lines of the page. */
  lines: string[];
}

export function indexPages(texts: readonly { page: number; text: string }[]): PageIndex[] {
  return texts.map(({ page, text }) => ({
    page,
    folded: fold(text),
    squashed: squash(text),
    lines: text
      .split("\n")
      .map(fold)
      .filter((l) => l.length > 0),
  }));
}

const isAlnum = (c: string | undefined): boolean => c !== undefined && /[a-z0-9]/.test(c);

/** `needle` inside `hay` as whole words. */
function hasWord(hay: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    if (!isAlnum(hay[at - 1]) && !isAlnum(hay[at + needle.length])) return true;
    from = at + 1;
  }
}

function fuzzyBudget(len: number): number {
  if (len >= 12) return 2;
  if (len >= 6) return 1;
  return 0;
}

function fuzzyInLines(lines: readonly string[], needle: string, max: number): boolean {
  const nw = needle.split(" ").length;
  for (const line of lines) {
    const words = line.split(" ");
    for (let n = Math.max(1, nw - 1); n <= nw + 1; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const cand = words.slice(i, i + n).join(" ");
        if (editDistance(cand, needle, max) <= max) return true;
      }
    }
  }
  return false;
}

export interface Location {
  kind: MatchKind | null;
  /** File pages where the name was found with the best kind of match. */
  pages: number[];
}

/**
 * Where a name shows up in the book, trying the strictest match first:
 * exact words, then ignoring spaces and punctuation (letter-spaced text),
 * then a small number of wrong letters (OCR).
 */
export function locate(name: string, index: readonly PageIndex[]): Location {
  const needle = fold(name);
  const exact = index.filter((p) => hasWord(p.folded, needle)).map((p) => p.page);
  if (exact.length > 0) return { kind: "exact", pages: exact };

  const sq = squash(name);
  if (sq.length >= 6) {
    const pages = index.filter((p) => p.squashed.includes(sq)).map((p) => p.page);
    if (pages.length > 0) return { kind: "squash", pages };
  }

  const max = fuzzyBudget(needle.length);
  if (max > 0) {
    const pages = index.filter((p) => fuzzyInLines(p.lines, needle, max)).map((p) => p.page);
    if (pages.length > 0) return { kind: "fuzzy", pages };
  }
  return { kind: null, pages: [] };
}
