/**
 * Build codes.
 *
 * A player reads this off the web builder and types it into Foundry, or pastes
 * it into a group chat, so it has to survive being read aloud, written down and
 * retyped. It is also the only thing standing between a stranger and someone
 * else's character, so it has to carry enough entropy that codes cannot be
 * enumerated.
 *
 * ## Why letters and digits alternate
 *
 * The confusable pairs — O and 0, I and 1, S and 5, B and 8 — are only
 * ambiguous when a position could hold either kind of character. Fixing the
 * kind by position resolves every one of them: in a letter slot a `0` can only
 * ever have been an O, and in a digit slot an `O` can only ever have been a 0.
 *
 * The previous scheme solved the same problem by *deleting* I, L, O and U from
 * a base32 alphabet. This one solves it by context and gets those letters back,
 * which is also why `normalizeCode` can be more forgiving than it used to be:
 * it knows what kind of character belongs where.
 *
 * ## What it costs, stated plainly
 *
 * Eight alternating characters is 26⁴ × 10⁴ = 4.569.760.000 codes, or 32,1
 * bits. The base32 scheme it replaces was 32¹⁰ — 50 bits, and 246.381 times
 * larger. That is a real reduction and the reason `handler.ts` rate-limits
 * failed reads: at ten thousand stored characters a code is one guess in
 * 457.000, which is decades of guessing at a few tries per minute and about two
 * hours at fifty per second. The limiter is what keeps the second number from
 * being the one that applies.
 *
 * Codes minted under the old scheme are still read, still resolve, and still
 * import. See `normalizeCode`.
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** Letter, digit, letter, digit — eight of them. */
const CODE_LENGTH = 8;
const GROUP_SIZE = 4;

/** Whether position `index` of a code holds a letter. Even positions do. */
function wantsLetter(index: number): boolean {
  return index % 2 === 0;
}

/** Digits people type where a letter belongs, mapped to the letter they meant. */
const AS_LETTER = new Map([
  ["0", "O"],
  ["1", "I"],
  ["2", "Z"],
  ["5", "S"],
  ["6", "G"],
  ["8", "B"],
]);

/** Letters people type where a digit belongs, mapped to the digit they meant. */
const AS_DIGIT = new Map([
  ["O", "0"],
  ["I", "1"],
  ["L", "1"],
  ["Z", "2"],
  ["S", "5"],
  ["G", "6"],
  ["B", "8"],
]);

/**
 * The base32 scheme this replaced: ten characters, I/L/O/U removed.
 *
 * Kept because codes minted under it are printed on people's character sheets,
 * saved in Foundry worlds and pasted in chat logs. A scheme change is not a
 * reason for those to stop resolving.
 */
const LEGACY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LEGACY_LENGTH = 10;
const LEGACY_CONFUSABLE = new Map([
  ["I", "1"],
  ["L", "1"],
  ["O", "0"],
  ["U", "V"],
]);

/**
 * One uniformly random character of `alphabet`.
 *
 * Neither 26 nor 10 divides 256, so a plain `byte % length` would make the
 * first few characters of each alphabet measurably more likely — with 26 that
 * is a 10% bias on the first four letters. Bytes at or above the largest usable
 * multiple are discarded instead, which costs 8,6% of draws for letters and
 * 2,3% for digits and is exactly uniform.
 */
function pick(alphabet: string, random: Crypto): string {
  const limit = 256 - (256 % alphabet.length);
  const byte = new Uint8Array(1);

  for (;;) {
    random.getRandomValues(byte);
    const value = byte[0] as number;
    if (value < limit) return alphabet[value % alphabet.length] as string;
  }
}

/** A fresh code, in storage form. */
export function generateCode(random: Crypto = crypto): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index++) {
    code += pick(wantsLetter(index) ? LETTERS : DIGITS, random);
  }

  return code;
}

/**
 * The secret that says a code is yours.
 *
 * A code is public — it is passed around, that is its whole job — so it cannot
 * also be the permission to overwrite what it points at. This is minted once,
 * travels back to the builder that published the character, and is stored
 * beside the code in that person's Codex. Without it the store refuses to
 * replace a build, which is what keeps a code from being a way to delete a
 * stranger's character.
 *
 * 128 bits, hex, never shown to a player and never returned by a read.
 */
export function generateWriteToken(random: Crypto = crypto): string {
  const bytes = new Uint8Array(16);
  random.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** What gets stored for a token, so the store never holds the token itself. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Whether two secrets match, in time that does not depend on where they differ.
 *
 * Both sides are hex of a fixed length here, so this is not the classic remote
 * timing attack — but a comparison that returns early on the first wrong
 * character is a habit worth not having in the one function that decides
 * whether a stranger may overwrite a character.
 */
export function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/** Group a raw code for display: `A7K2-M9X4`, or `K7M2X-QF9AB` for a legacy one. */
export function format(raw: string): string {
  const size = raw.length === LEGACY_LENGTH ? 5 : GROUP_SIZE;
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += size) {
    groups.push(raw.slice(i, i + size));
  }
  return groups.join("-");
}

/** A legacy ten-character code, or null. */
function normalizeLegacy(stripped: string): string | null {
  const mapped = stripped
    .split("")
    .map((char) => LEGACY_CONFUSABLE.get(char) ?? char)
    .join("");

  for (const char of mapped) {
    if (!LEGACY_ALPHABET.includes(char)) return null;
  }
  return mapped;
}

/** An eight-character alternating code, or null. */
function normalizeAlternating(stripped: string): string | null {
  let code = "";

  for (let index = 0; index < stripped.length; index++) {
    const char = stripped[index] as string;

    if (wantsLetter(index)) {
      const letter = LETTERS.includes(char) ? char : AS_LETTER.get(char);
      // A 4 in a letter slot is not a misread letter, it is a wrong code.
      if (!letter) return null;
      code += letter;
    } else {
      const digit = DIGITS.includes(char) ? char : AS_DIGIT.get(char);
      if (!digit) return null;
      code += digit;
    }
  }

  return code;
}

/**
 * Normalise a code as typed.
 *
 * Accepts any case, any spacing, and the substitutions people actually make
 * when reading a code off a screen. Returns null if what is left cannot be a
 * code, so a malformed one is rejected before it reaches storage.
 *
 * Length is what tells the two schemes apart, and it can: eight characters is
 * never a legacy code and ten is never a new one.
 */
export function normalizeCode(input: string): string | null {
  const stripped = input.toUpperCase().replace(/[^0-9A-Z]/g, "");

  if (stripped.length === CODE_LENGTH) return normalizeAlternating(stripped);
  if (stripped.length === LEGACY_LENGTH) return normalizeLegacy(stripped);
  return null;
}

/** The storage key for a code, once normalised. */
export function storageKey(normalized: string): string {
  return `build:${normalized}`;
}

/** Where the hashed write token for a code lives. Never returned by a read. */
export function ownerKey(normalized: string): string {
  return `owner:${normalized}`;
}
