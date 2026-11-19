import type { TextItem } from "./text-model.js";

export interface Line {
  text: string;
  x: number;
  y: number;
}

/**
 * Group runs of text into lines: same baseline (within half a text height),
 * left to right, with a space where there is a visible gap. Scanned books give
 * one run per glyph, so a gap below 15 % of the height is read as no gap.
 */
export function groupLines(items: readonly TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  let rowY = Number.NaN;
  let rowH = 1;
  for (const it of sorted) {
    if (rows.length === 0 || Math.abs(it.y - rowY) > 0.5 * Math.max(rowH, it.h, 1)) {
      rows.push([it]);
      rowY = it.y;
      rowH = it.h;
    } else {
      rows[rows.length - 1]?.push(it);
    }
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let end = Number.NaN;
    for (const it of row) {
      const gap = it.x - end;
      const needsSpace = !Number.isNaN(end) && gap > 0.15 * Math.max(it.h, 1);
      if (needsSpace && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      text += it.str;
      end = it.x + it.w;
    }
    const first = row[0];
    return { text: text.replace(/\s+/g, " ").trim(), x: first?.x ?? 0, y: first?.y ?? 0 };
  });
}
