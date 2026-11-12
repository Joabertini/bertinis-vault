/**
 * The order the Forge asks its questions in.
 *
 * Lives here rather than inside the route because the order carries rules of
 * its own — Mejoras adds to scores that Aptitudes has to have produced first,
 * Dones needs a class and a background to have anything to offer — and a rule
 * that only exists inside a component's `useMemo` cannot be checked.
 */

export type ChamberKey =
  | "ancestry"
  | "calling"
  | "origin"
  | "attributes"
  | "growth"
  | "gifts"
  | "gear"
  | "spells"
  | "identity";

/**
 * How much of D&D the player already knows, as the Forge asked it.
 *
 * Re-exported from the store's `Pace`; this module only reads it.
 */
export type Pace = "nuevo" | "veterano";

/**
 * The chambers, in the order this player should meet them.
 *
 * Only the opening four move. A first character is built from the outside in —
 * you can picture a dwarf long before you can picture a 16 — and a twentieth
 * is built from the numbers out, because the spread decides whether the
 * concept works at all and every later choice is judged against it.
 *
 * The tail never moves:
 *   growth    adds to scores, so it cannot precede attributes
 *   gifts     offers what the class and background grant, so it needs both
 *   gear      wants to know what you can carry and use
 *   spells    only exists for casters, hence the flag
 *   identity  last for everyone: nobody wants to name a stranger
 */
export function chamberOrder(pace: Pace, caster: boolean): ChamberKey[] {
  const opening: ChamberKey[] =
    pace === "veterano"
      ? ["attributes", "calling", "ancestry", "origin"]
      : ["ancestry", "calling", "origin", "attributes"];

  const list: ChamberKey[] = [...opening, "growth", "gifts", "gear"];
  if (caster) list.push("spells");
  list.push("identity");

  return list;
}

/** Where the Forge opens for this player. */
export function firstChamber(pace: Pace): ChamberKey {
  return chamberOrder(pace, false)[0]!;
}
