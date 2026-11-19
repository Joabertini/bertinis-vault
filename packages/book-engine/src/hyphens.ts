import type { Dictionary } from "./dictionary.js";

const SOFT_OR_HARD = /[\p{L}][-­]$/u;

/**
 * Join words the typesetter cut at the end of a line: "crum-" / "bling" →
 * "crumbling". If the joined word is not in the dictionary but both halves
 * are, it was a real compound ("well-" / "known" → "well-known"). A cut
 * followed by a capital or a digit is left alone.
 */
export function joinHyphens(
  input: readonly string[],
  dict: Dictionary,
): { lines: string[]; joins: number } {
  const lines = [...input];
  const out: string[] = [];
  let joins = 0;

  for (let i = 0; i < lines.length; i++) {
    let cur = lines[i] ?? "";
    const next = lines[i + 1];
    if (next !== undefined && SOFT_OR_HARD.test(cur)) {
      const curTokens = cur.split(" ");
      const nextTokens = next.split(" ");
      const last = (curTokens.pop() ?? "").slice(0, -1);
      const first = nextTokens.shift() ?? "";
      if (/^\p{Ll}/u.test(first)) {
        let joined: string;
        if (dict.knownToken(last + first)) joined = last + first;
        else if (dict.knownToken(last) && dict.knownToken(first)) joined = `${last}-${first}`;
        else joined = last + first;
        cur = [...curTokens, joined].join(" ");
        joins++;
        // The rest of the next line stays as its own line.
        lines[i + 1] = nextTokens.join(" ");
        if (lines[i + 1] === "") lines.splice(i + 1, 1);
      }
    }
    out.push(cur);
  }
  return { lines: out, joins };
}
