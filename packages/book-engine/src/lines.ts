import type { TextItem } from "./text-model.js";

export interface Line {
  text: string;
  x: number;
  y: number;
}

/**
 * Group runs of text into rows: same baseline (within half a text height),
 * top to bottom, each row left to right.
 */
export function groupRows(items: readonly TextItem[]): TextItem[][] {
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
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * The text of one row, with a space where there is a visible gap. Scanned
 * books give one run per glyph, so a gap below 15 % of the height is read as
 * no gap.
 */
export function rowText(row: readonly TextItem[]): string {
  let text = "";
  let end = Number.NaN;
  for (const it of row) {
    const gap = it.x - end;
    const needsSpace = !Number.isNaN(end) && gap > 0.15 * Math.max(it.h, 1);
    if (needsSpace && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
    text += it.str;
    end = it.x + it.w;
  }
  return text.replace(/\s+/g, " ").trim();
}

export function groupLines(items: readonly TextItem[]): Line[] {
  return groupRows(items).map((row) => {
    const first = row[0];
    return { text: rowText(row), x: first?.x ?? 0, y: first?.y ?? 0 };
  });
}
