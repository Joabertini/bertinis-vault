import { fold } from "./normalize.js";

/**
 * The words a language is known to use, with how often. Built from the
 * builder's own rules text and from the words a book repeats cleanly.
 * Everything is stored folded (lowercase, no accents).
 */
export class Dictionary {
  private readonly counts = new Map<string, number>();

  /**
   * `singleLetterWords` are the one-letter words of the language ("a", "i" in
   * English). Without them a lone "a" counts as a stray letter and gets glued
   * to its neighbour ("to a" → "toa"); other single letters stay unknown.
   */
  constructor(singleLetterWords: readonly string[] = ["a", "i"]) {
    for (const w of singleLetterWords) this.add(w, 1);
  }

  add(word: string, times = 1): void {
    const w = fold(word);
    if (w.length > 0) this.counts.set(w, (this.counts.get(w) ?? 0) + times);
  }

  get size(): number {
    return this.counts.size;
  }

  /** Every word, folded. */
  words(): string[] {
    return [...this.counts.keys()];
  }

  /** A word already folded. */
  has(folded: string): boolean {
    return this.counts.has(folded);
  }

  frequency(word: string): number {
    return this.counts.get(fold(word)) ?? 0;
  }

  /**
   * A token as it appears in a line: ignores punctuation around it, a
   * trailing 's, and anything with digits (dice, numbers, "3rd").
   */
  knownToken(token: string): boolean {
    let s = fold(token).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (s.length === 0 || /[0-9]/.test(s)) return true;
    if (s.endsWith("'s")) s = s.slice(0, -2);
    return this.counts.has(s);
  }
}

export function dictionaryFromWords(words: Iterable<string>): Dictionary {
  const d = new Dictionary();
  for (const w of words) d.add(w);
  return d;
}

/** Every word of every string in the given parsed JSON files. */
export function dictionaryFromRules(...files: readonly unknown[]): Dictionary {
  const d = new Dictionary();
  const stack: unknown[] = [...files];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node === "string") {
      for (const w of node.match(/\p{L}{2,}/gu) ?? []) d.add(w);
    } else if (Array.isArray(node)) {
      for (const n of node) stack.push(n);
    } else if (typeof node === "object" && node !== null) {
      for (const n of Object.values(node)) stack.push(n);
    }
  }
  return d;
}

/** First index in `sorted` whose value is >= `key`. */
function lowerBound(sorted: readonly string[], key: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? "") < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const reverse = (s: string): string => [...s].reverse().join("");

/**
 * Add the words a book itself repeats, for names and terms the rules text does
 * not have. Three guards keep damage out:
 * - only tokens spelled like a normal word (optional capital, then lowercase),
 *   so a damaged "IlIusion" is not learned;
 * - at least four letters and three sightings;
 * - never a piece of a longer known word. A scan that splits "because" leaves
 *   "beca" behind many times over; "beca" starts a known word, so it is not
 *   learned, and the join "beca" + "use" can still be made.
 */
export function addBookVocabulary(d: Dictionary, texts: Iterable<string>, minCount = 3): void {
  const seen = new Map<string, number>();
  for (const text of texts) {
    for (const w of text.match(/\p{L}[\p{L}]*/gu) ?? []) {
      if (/^\p{Lu}?\p{Ll}{3,}$/u.test(w)) {
        const f = fold(w);
        seen.set(f, (seen.get(f) ?? 0) + 1);
      }
    }
  }

  const known = d.words();
  const forward = [...known].sort();
  const backward = known.map(reverse).sort();
  const piece = (w: string): boolean => {
    const i = lowerBound(forward, w);
    if ((forward[i] ?? "").startsWith(w) && forward[i] !== w) return true;
    const j = lowerBound(backward, reverse(w));
    return (backward[j] ?? "").startsWith(reverse(w)) && backward[j] !== reverse(w);
  };

  for (const [w, n] of seen) {
    if (n >= minCount && !d.has(w) && !piece(w)) d.add(w, n);
  }
}
