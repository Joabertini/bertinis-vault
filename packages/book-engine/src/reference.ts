import { fold } from "./normalize.js";

/** One entry of the builder's own data (public/rules/*.json) used as ground truth. */
export interface RefEntry {
  /** The key in the file: "air bubble|aag". */
  key: string;
  name: string;
  source: string;
  /** Printed page number in the book, when the data has it. */
  page: number | null;
}

/**
 * Entries of one rules file that come from the given books.
 * `rules` is the parsed file: an object keyed "name|source".
 */
export function referenceFromRules(
  rules: Readonly<Record<string, unknown>>,
  sources: ReadonlySet<string>,
): RefEntry[] {
  const out: RefEntry[] = [];
  for (const [key, value] of Object.entries(rules)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as { name?: unknown; source?: unknown; page?: unknown };
    if (typeof v.name !== "string" || typeof v.source !== "string") continue;
    if (!sources.has(v.source)) continue;
    out.push({
      key,
      name: v.name,
      source: v.source,
      page: typeof v.page === "number" ? v.page : null,
    });
  }
  return out;
}

/** Every word in every string of the data, folded: the vocabulary of the rules. */
export function vocabularyFromRules(...files: readonly unknown[]): Set<string> {
  const vocab = new Set<string>();
  const stack: unknown[] = [...files];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node === "string") {
      for (const w of node.match(/\p{L}{2,}/gu) ?? []) vocab.add(fold(w));
    } else if (Array.isArray(node)) {
      for (const n of node) stack.push(n);
    } else if (typeof node === "object" && node !== null) {
      for (const n of Object.values(node)) stack.push(n);
    }
  }
  return vocab;
}
