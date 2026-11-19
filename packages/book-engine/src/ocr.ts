import type { Dictionary } from "./dictionary.js";

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
export function fixOcrToken(token: string, dict: Dictionary): string | null {
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
  return best === null ? null : prefix + best + suffix;
}

export function fixOcrLine(line: string, dict: Dictionary): { text: string; fixes: number } {
  let fixes = 0;
  const text = line
    .split(" ")
    .map((tok) => {
      const fixed = fixOcrToken(tok, dict);
      if (fixed === null) return tok;
      fixes++;
      return fixed;
    })
    .join(" ");
  return { text, fixes };
}
