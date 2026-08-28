/**
 * The three items a character can be attuned to.
 *
 * "A creature can be attuned to no more than three magic items at a time" is
 * the same sentence in both editions, and it is a *choice* rather than a
 * consequence: a character who owns four attunement items owns four and uses
 * three, and which three is the player's answer. Nothing in the builder asked
 * it, so every magic item reached Foundry unattuned — a Belt of Giant Strength
 * that sets no Strength, a Cloak of Protection worth no bonus.
 *
 * Reported, not refused, like every other limit here. A table that hands out a
 * fourth attunement is a table making a ruling, and a builder that deletes the
 * fourth pick is arguing with it.
 */

/** How many at once, both editions. */
export const ATTUNEMENT_SLOTS = 3;

export type AttunableItem = {
  /** The id the draft stores. Two copies of one item are one entry. */
  id: string;
  label: string;
};

export type AttunementState = {
  slots: number;
  /** What the player attuned to, in the order they carry it. */
  attuned: AttunableItem[];
  /** Every item they carry that could be attuned to. */
  offered: AttunableItem[];
  used: number;
  /** How many over the limit, which is reported rather than enforced. */
  over: number;
};

/**
 * What the character is attuned to, out of what they could be.
 *
 * An id that is no longer carried is dropped rather than counted: a player who
 * attunes to a wand and then takes it out of the bag is attuned to nothing,
 * and holding the slot open would tell them they have two left when they have
 * three. The same id twice is one attunement — the bag stores quantities, and
 * two identical wands still take one slot each only if both are attuned, which
 * is a thing the bag cannot express and the rules do not need here.
 */
export function attunementFor(input: {
  /** Everything carried that requires attunement, deduplicated by id. */
  offered: AttunableItem[];
  /** The ids the player marked. */
  attuned: string[];
}): AttunementState {
  const byId = new Map<string, AttunableItem>();
  for (const item of input.offered) {
    if (item.id && !byId.has(item.id)) byId.set(item.id, item);
  }

  const marked = new Set(input.attuned);
  const attuned = [...byId.values()].filter((item) => marked.has(item.id));

  return {
    slots: ATTUNEMENT_SLOTS,
    attuned,
    offered: [...byId.values()],
    used: attuned.length,
    over: Math.max(attuned.length - ATTUNEMENT_SLOTS, 0),
  };
}
