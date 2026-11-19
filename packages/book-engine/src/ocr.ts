import type { Dictionary } from "./dictionary.js";
import { fold } from "./normalize.js";

/*
 * Letters an OCR confuses. Each pair is (what the OCR wrote, what the page
 * had). Only applied to a word the dictionary does not know, and only if
 * exactly one change turns it into a word it does.
 */
const CONFUSIONS: readonly (readonly [string, string])[] = [
  ["i", "l"],
  ["l", "i"],
  ["I", "l"],
  ["l", "I"],
  ["c", "e"],
  ["e", "c"],
  ["rn", "m"],
  ["m", "rn"],
  ["cl", "d"],
  ["d", "cl"],
  ["n", "u"],
  ["u", "n"],
  ["vv", "w"],
  ["E", "C"],
  ["C", "E"],
  ["1", "l"],
];

const SHAPE = /^([^\p{L}]*)(\p{L}[\p{L}'’]*\p{L})([^\p{L}]*)$/u;

/**
 * The corrected spelling of one token, or null if it needs no change or no
 * single confusion fixes it. Keeps punctuation around the word.
 */
export function fixOcrToken(
  token: string,
  dict: Dictionary,
  book?: ReadonlyMap<string, number>,
): string | null {
  const m = SHAPE.exec(token);
  if (!m) return null;
  const [, prefix = "", word = "", suffix = ""] = m;
  if (word.length < 4 || dict.knownToken(word)) return null;

  let best: string | null = null;
  let bestFreq = 0;
  for (let p = 0; p < word.length; p++) {
    for (const [from, to] of CONFUSIONS) {
      if (!word.startsWith(from, p)) continue;
      const cand = word.slice(0, p) + to + word.slice(p + from.length);
      const f = dict.frequency(cand);
      if (f > bestFreq) {
        best = cand;
        bestFreq = f;
      }
    }
  }
  if (best === null) return null;

  // A word the dictionary lacks but the book repeats is probably a real term
  // ("clump"), not damage... unless the corrected form is also in the book:
  // OCR repeats its own mistakes ("warIock" ten times), and the clean
  // "warlock" shows up elsewhere. So repetition protects a word only when the
  // correction never appears.
  if (book && (book.get(fold(word)) ?? 0) >= REPEATED && (book.get(fold(best)) ?? 0) === 0) {
    return null;
  }
  return prefix + best + suffix;
}

/** Sightings after which an unknown word counts as repeated. */
const REPEATED = 3;

/** How many times each word (folded) appears in the given lines. */
export function wordCounts(lines: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const w of line.match(/\p{L}[\p{L}'’]*/gu) ?? []) {
      const k = fold(w);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
}

export function fixOcrLine(
  line: string,
  dict: Dictionary,
  book?: ReadonlyMap<string, number>,
): { text: string; fixes: number } {
  let fixes = 0;
  const text = line
    .split(" ")
    .map((tok) => {
      const fixed = fixOcrToken(tok, dict, book);
      if (fixed === null) return tok;
      fixes++;
      return fixed;
    })
    .join(" ");
  return { text, fixes };
}
