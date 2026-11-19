export type PageKind = "empty" | "spell-list" | "table" | "prose";

const LEVEL_HEAD = /^(?:cantrips?|trucos?|nivel\s+\d|\d+\s*(?:st|nd|rd|th)[\s-]*level)\b/i;

/**
 * What a page is, by its text: nothing to read, a list of spells by level,
 * a table (many lines with several numbers), or running text.
 */
export function classifyPage(text: string): PageKind {
  if (text.replace(/\s/g, "").length < 20) return "empty";
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "empty";

  const numeric = lines.filter((l) => (l.match(/\b\d+\b/g) ?? []).length >= 3).length;
  if (numeric / lines.length > 0.35) return "table";

  const heads = lines.filter((l) => LEVEL_HEAD.test(l.trim())).length;
  const meanLength = lines.reduce((n, l) => n + l.length, 0) / lines.length;
  if (heads >= 2 && meanLength < 28) return "spell-list";

  return "prose";
}
