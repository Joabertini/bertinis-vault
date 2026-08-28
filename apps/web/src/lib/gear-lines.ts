/**
 * The bag is a text box, and a text box has no column for "how many".
 *
 * Every line used to mean exactly one object: the barbarian's two handaxes
 * arrived as two identical lines, `uniqueEntries` collapsed them to one, and
 * `normalizeEquipmentEntry` stamped `quantity: 1` on the survivor. A ranger who
 * took the twenty arrows their class hands out imported holding a single arrow
 * and had to fix it by hand in Foundry — the exact retyping the starting kit
 * exists to remove.
 *
 * So a line may carry a count as a trailing ` x20`. It stays a text box: the
 * player can type `x20` themselves, edit the number, or ignore the whole
 * convention and write one line per object, which still counts correctly.
 */

/** A line of the bag, read apart. */
export type GearLine = {
  id: string;
  quantity: number;
};

const COUNT = /\s+x(\d+)$/i;

/** `arrow|xphb` with a count, or bare when there is only one. */
export function formatGearLine(id: string, quantity: number): string {
  return quantity > 1 ? `${id} x${quantity}` : id;
}

/**
 * A line read apart into object and count.
 *
 * A line with no count is one object. `x0` and `x-3` are not counts a bag can
 * hold, so they stay part of the name and resolve — or fail to — as written.
 */
export function parseGearLine(line: string): GearLine {
  const match = COUNT.exec(line);
  const quantity = match?.[1] ? Number.parseInt(match[1], 10) : 0;
  if (!match || quantity < 1) return { id: line.trim(), quantity: 1 };
  return { id: line.slice(0, match.index).trim(), quantity };
}

/**
 * The bag as objects and counts, one entry per distinct object.
 *
 * Repeated lines sum instead of colliding, so the two ways of writing three
 * daggers — three lines, or one `x3` — reach Foundry as the same three daggers.
 * Order follows first mention: a bag that reshuffles itself when the player
 * adds a rope reads like a bug.
 */
export function collapseGearLines(lines: string[]): GearLine[] {
  const order: string[] = [];
  const totals = new Map<string, number>();

  for (const line of lines) {
    const { id, quantity } = parseGearLine(line);
    if (!id) continue;
    if (!totals.has(id)) order.push(id);
    totals.set(id, (totals.get(id) ?? 0) + quantity);
  }

  return order.map((id) => ({ id, quantity: totals.get(id) ?? 1 }));
}
