import type { Dictionary } from "./dictionary.js";

const MAX_GROUP = 14;
const hasLetter = (t: string): boolean => /\p{L}/u.test(t);
const hasDigit = (t: string): boolean => /[0-9]/.test(t);

/**
 * Join letters that a scanned page spread apart: "a n i m a l" → "animal",
 * "fi n d" → "find", "wizard s" → "wizards".
 *
 * The line is cut into groups of neighbouring tokens. A group of several
 * tokens becomes one word only if the joined word is in the dictionary and at
 * least one of its tokens was not a word by itself, so "no thing" stays as it
 * is. The cut with the fewest unknown words wins.
 */
export function fixSpacing(line: string, dict: Dictionary): { text: string; merged: number } {
  const tokens = line.split(" ").filter((t) => t.length > 0);
  const n = tokens.length;
  const cost = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const from = new Array<number>(n + 1).fill(0);
  cost[0] = 0;

  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - MAX_GROUP); i < j; i++) {
      const base = cost[i] ?? Number.POSITIVE_INFINITY;
      if (!Number.isFinite(base)) continue;
      const c = groupCost(tokens.slice(i, j), dict);
      if (base + c < (cost[j] ?? Number.POSITIVE_INFINITY)) {
        cost[j] = base + c;
        from[j] = i;
      }
    }
  }

  const groups: string[][] = [];
  for (let j = n; j > 0; j = from[j] ?? 0) groups.unshift(tokens.slice(from[j] ?? 0, j));
  let merged = 0;
  const out = groups.map((g) => {
    merged += g.length - 1;
    return g.join("");
  });
  return { text: out.join(" "), merged };
}

function groupCost(group: readonly string[], dict: Dictionary): number {
  if (group.length === 1) {
    const t = group[0] ?? "";
    if (!hasLetter(t) || hasDigit(t)) return 0;
    if (dict.knownToken(t)) return commonness(dict.frequency(letters(t)));
    return 2;
  }
  if (group.some((t) => hasDigit(t) || !hasLetter(t))) return Number.POSITIVE_INFINITY;
  const joined = group.join("");
  if (!dict.knownToken(joined)) return Number.POSITIVE_INFINITY;

  // Every piece is a word by itself: "frighten ed", "no thing", "to day".
  // The joined word wins only if it is much more common than any piece:
  // "frightened" is far more common than "frighten" and "ed"; "today" is not
  // more common than "to".
  if (group.every((t) => dict.knownToken(t))) {
    const whole = dict.frequency(letters(joined));
    const biggestPiece = Math.max(...group.map((t) => dict.frequency(letters(t))));
    if (whole < 2 * biggestPiece) return Number.POSITIVE_INFINITY;
    // Better than leaving the pieces apart (which cost nothing).
    return -0.1 * (group.length - 1);
  }
  return 0.01 * (group.length - 1) + commonness(dict.frequency(letters(joined)));
}

/**
 * A tie-breaker, never more than 0.003: between two ways of cutting a line
 * that both make words, the one made of more common words wins ("for that"
 * over "fort hat").
 */
const commonness = (frequency: number): number =>
  0.003 * (1 - Math.min(1, Math.log10(frequency + 1) / 6));

const letters = (t: string): string => t.replace(/[^\p{L}']/gu, "");
