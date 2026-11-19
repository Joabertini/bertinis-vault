import { classifyPage, type PageKind } from "./classify.js";
import { splitColumns } from "./columns.js";
import type { Dictionary } from "./dictionary.js";
import { joinHyphens } from "./hyphens.js";
import { groupLines } from "./lines.js";
import { fixOcrLine, wordCounts } from "./ocr.js";
import { dropRunning, findRunningKeys } from "./running.js";
import { fixSpacing } from "./spacing.js";
import type { PageText } from "./text-model.js";

export interface Fixes {
  spacingMerges: number;
  hyphenJoins: number;
  ocrFixes: number;
  runningRowsDropped: number;
}

export interface CleanPage {
  page: number;
  kind: PageKind;
  text: string;
  fixes: Fixes;
}

export interface CleanBook {
  pages: CleanPage[];
  totals: Fixes;
  /** Pages per kind. */
  kinds: Record<PageKind, number>;
  /** True when nine of ten pages have no text: a book of images (maps). */
  textless: boolean;
}

export interface CleanOptions {
  /** Correct OCR letter confusions. On by default; turn off for languages the dictionary does not cover. */
  ocr?: boolean;
}

/**
 * P1: from positioned text to clean text, page by page.
 * Running heads and feet go; the page is read column by column; letters
 * spread apart are joined; words cut at the end of a line are joined; OCR
 * confusions in words the dictionary does not know are corrected.
 */
export function cleanBook(
  pages: readonly PageText[],
  dict: Dictionary,
  options: CleanOptions = {},
): CleanBook {
  const useOcr = options.ocr !== false;
  const running = findRunningKeys(pages);
  const totals: Fixes = { spacingMerges: 0, hyphenJoins: 0, ocrFixes: 0, runningRowsDropped: 0 };
  const kinds: Record<PageKind, number> = { empty: 0, "spell-list": 0, table: 0, prose: 0 };

  const staged = pages.map((page) => {
    const fixes: Fixes = { spacingMerges: 0, hyphenJoins: 0, ocrFixes: 0, runningRowsDropped: 0 };
    const { items, dropped } = dropRunning(page, running);
    fixes.runningRowsDropped = dropped;

    const columns = splitColumns(items, page.width).map((col) => {
      let lines = groupLines(col).map((l) => l.text.replace(/­/g, "-"));
      lines = lines.map((line) => {
        const r = fixSpacing(line, dict);
        fixes.spacingMerges += r.merged;
        return r.text;
      });
      const joined = joinHyphens(lines, dict);
      fixes.hyphenJoins += joined.joins;
      return joined.lines;
    });
    return { page: page.page, fixes, columns };
  });

  // OCR comes last because it needs the whole book: how often each word shows up.
  const counts = useOcr ? wordCounts(staged.flatMap((s) => s.columns.flat())) : undefined;

  const out = staged.map((s): CleanPage => {
    const { fixes } = s;
    const text = s.columns
      .map((lines) =>
        (useOcr
          ? lines.map((line) => {
              const r = fixOcrLine(line, dict, counts);
              fixes.ocrFixes += r.fixes;
              return r.text;
            })
          : lines
        ).join("\n"),
      )
      .join("\n\n");
    const kind = classifyPage(text);
    kinds[kind]++;
    for (const k of Object.keys(totals) as (keyof Fixes)[]) totals[k] += fixes[k];
    return { page: s.page, kind, text, fixes };
  });

  return {
    pages: out,
    totals,
    kinds,
    textless: pages.length > 0 && kinds.empty / pages.length >= 0.9,
  };
}
