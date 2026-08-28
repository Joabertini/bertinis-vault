const armorFormulaBase: Record<string, number> = {
  "10+DEX": 10,
  "11+DEX": 11,
  "12+DEX": 12,
  "13+DEX": 13,
  "16": 16,
  "17": 17,
  "18": 18,
};

export function calculateArmorClass(input: {
  armorFormula?: string;
  dexModifier: number;
  hasShield?: boolean;
  unarmoredAbilityModifier?: number;
  dexCap?: number;
}): number {
  const dexContribution =
    input.dexCap === undefined
      ? input.dexModifier
      : Math.min(input.dexModifier, input.dexCap);

  let base = 10 + dexContribution;
  const formula = input.armorFormula;
  const formulaBase = formula ? armorFormulaBase[formula] : undefined;

  if (formulaBase !== undefined && formula) {
    base = formulaBase + (formula.endsWith("+DEX") ? dexContribution : 0);
  } else if (formula === "special") {
    base = 10 + input.dexModifier + (input.unarmoredAbilityModifier ?? 0);
  } else if (formula) {
    // Armour picked from the index brings its own base, so the shapes have to
    // be read rather than looked up: "14" for heavy, "11+DEX" for light,
    // "14+DEX2" for medium.
    const parsed = /^(\d+)(?:\+DEX(\d+)?)?$/.exec(formula);
    if (parsed) {
      const armorBase = Number(parsed[1]);
      const cap = parsed[2] === undefined ? undefined : Number(parsed[2]);
      const dexPart = formula.includes("+DEX")
        ? cap === undefined
          ? input.dexModifier
          : Math.min(input.dexModifier, cap)
        : 0;

      base = armorBase + dexPart;
    }
  }

  return base + (input.hasShield ? 2 : 0);
}

/**
 * What a level is worth in hit points, and where the number comes from.
 *
 * Two ways, and both are printed in both editions on the class's own page:
 * roll the hit die, or take the fixed number the class states, which is
 * always half the die plus one. A table picks one and the character sheet
 * records the result — so the builder has to be able to say which, or every
 * character who rolled has a wrong number on their sheet.
 *
 * The first level is neither: it is the die's maximum, never rolled. And it is
 * the *character's* first level rather than each class's, which is the whole
 * of the multiclassing rule on the subject — a wizard 5 who takes a level of
 * fighter rolls for it like any other.
 */
export type HitPointMethod = "average" | "rolled";

/** The fixed number a class prints for a level after the first. */
export function averageHitPointsPerLevel(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1;
}

/**
 * A character's hit point maximum, level by level.
 *
 * `dice` is one die per character level, in the order the levels were taken,
 * so a multiclass character's levels each use the die of the class that level
 * was taken in.
 *
 * `rolls` is what the player actually rolled, indexed from the *second* level:
 * `rolls[0]` is level 2. A level with no roll falls back to the average, which
 * is what a half-filled sheet means — a character who has rolled up to level 4
 * and not beyond has four honest numbers and not a broken total. A number the
 * die cannot produce is not a roll either, and is ignored the same way rather
 * than trusted onto the sheet.
 *
 * Every level gives at least one hit point however bad the Constitution, which
 * is why the floor is per level and not on the total: a character whose later
 * levels each give nothing still gains one for each of them.
 */
export function hitPointsFor(input: {
  dice: number[];
  constitutionModifier: number;
  method?: HitPointMethod;
  rolls?: Array<number | null | undefined>;
}): number {
  const rolls = input.rolls ?? [];
  let total = 0;

  input.dice.forEach((die, at) => {
    const written = input.method === "rolled" ? rolls[at - 1] : null;
    const rolled =
      typeof written === "number" && Number.isInteger(written) && written >= 1 && written <= die
        ? written
        : null;
    const gained = at === 0 ? die : (rolled ?? averageHitPointsPerLevel(die));

    total += Math.max(gained + input.constitutionModifier, 1);
  });

  return Math.max(total, 1);
}

/** One die per character level, from the classes in the order they were taken. */
export function hitDiceByLevel(
  entries: Array<{ level: number; hitDie?: number | undefined }>,
  defaultHitDie = 8,
): number[] {
  return entries.flatMap((entry) =>
    Array.from({ length: entry.level }, () => entry.hitDie ?? defaultHitDie),
  );
}

export function calculateEstimatedHitPoints(input: {
  hitDie: number;
  level: number;
  constitutionModifier: number;
  method?: HitPointMethod;
  rolls?: Array<number | null | undefined>;
}): number {
  return hitPointsFor({
    dice: Array.from({ length: Math.max(input.level, 1) }, () => input.hitDie),
    constitutionModifier: input.constitutionModifier,
    ...(input.method ? { method: input.method } : {}),
    ...(input.rolls ? { rolls: input.rolls } : {}),
  });
}
