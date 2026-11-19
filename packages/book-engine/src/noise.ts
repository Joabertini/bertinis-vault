import { fold } from "./normalize.js";

export interface NoiseStats {
  /** Words in the text (runs of letters, 2 or more). */
  words: number;
  /** "a n i m a l": five or more single letters in a row. */
  letterSpacedRuns: number;
  /** A word cut at the end of a line: "crum-\nbling". */
  hyphenBreaks: number;
  /** Words with the OCR mark of l / I / 1 confusion inside lowercase text. */
  suspectWords: number;
  /** Share of words not in the vocabulary (0..1), or null without one. */
  unknownRatio: number | null;
}

const WORD = /\p{L}{2,}/gu;
const LETTER_SPACED = /(?<![\p{L}])(?:\p{L} ){4,}\p{L}(?![\p{L}])/gu;
const HYPHEN_BREAK = /\p{Ll}-\n\p{Ll}/gu;
// A capital I right after a lowercase letter and before another letter: "IlIusion".
const SUSPECT = /\p{Ll}I(?=\p{L})/gu;

export function measureNoise(text: string, vocabulary?: ReadonlySet<string>): NoiseStats {
  const words = text.match(WORD) ?? [];
  let unknownRatio: number | null = null;
  if (vocabulary && vocabulary.size > 0 && words.length > 0) {
    let unknown = 0;
    for (const w of words) if (!vocabulary.has(fold(w))) unknown++;
    unknownRatio = unknown / words.length;
  }
  return {
    words: words.length,
    letterSpacedRuns: (text.match(LETTER_SPACED) ?? []).length,
    hyphenBreaks: (text.match(HYPHEN_BREAK) ?? []).length,
    suspectWords: (text.match(SUSPECT) ?? []).length,
    unknownRatio,
  };
}
