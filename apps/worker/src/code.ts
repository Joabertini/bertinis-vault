/**
 * Build codes.
 *
 * A player reads this off the web builder and types it into Foundry, so it has
 * to survive being read aloud, written down and retyped. It is also the only
 * thing standing between a stranger and someone else's character, so it has to
 * carry enough entropy that codes cannot be enumerated.
 *
 * Crockford's base32 alphabet drops I, L, O and U: the first three because they
 * are read as 1 and 0, and U so the generator cannot spell anything unfortunate.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10;
const GROUP_SIZE = 5;

/** Characters people substitute, mapped to what they meant. */
const CONFUSABLE = new Map([
  ["I", "1"],
  ["L", "1"],
  ["O", "0"],
  ["U", "V"],
]);

/**
 * A fresh code.
 *
 * Ten base32 characters is fifty bits. At a billion stored builds, the chance
 * of guessing one in a single attempt is about one in a million, and the
 * birthday bound sits far beyond any realistic number of characters.
 */
export function generateCode(random: Crypto = crypto): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  random.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    // 256 is not a multiple of 32, but 32 divides 256 exactly, so masking the
    // low five bits stays uniform.
    code += ALPHABET[byte & 31];
  }

  return format(code);
}

/** Group a raw code for display: `K7M2X-QF9AB`. */
export function format(raw: string): string {
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += GROUP_SIZE) {
    groups.push(raw.slice(i, i + GROUP_SIZE));
  }
  return groups.join("-");
}

/**
 * Normalise a code as typed.
 *
 * Accepts any case, any spacing, and the substitutions people actually make
 * when reading a code off a screen. Returns null if what is left cannot be a
 * code, so a malformed one is rejected before it reaches storage.
 */
export function normalizeCode(input: string): string | null {
  const stripped = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .split("")
    .map((char) => CONFUSABLE.get(char) ?? char)
    .join("");

  if (stripped.length !== CODE_LENGTH) return null;
  for (const char of stripped) {
    if (!ALPHABET.includes(char)) return null;
  }

  return stripped;
}

/** The storage key for a code, once normalised. */
export function storageKey(normalized: string): string {
  return `build:${normalized}`;
}
