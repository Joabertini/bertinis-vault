/**
 * Dice formulas for the roll tray: "1d20+7", "2d6+4", "1d8 - 1", "d20".
 *
 * The 2024 sheet rolls its own (its page cannot import this file) with the same grammar, and
 * posts the finished roll to the tray; this one serves what is typed into the tray itself.
 */

import { rollDie } from "@/lib/dice";

export type RollMode = "normal" | "ventaja" | "desventaja";

export type RollResult = {
  total: number;
  /** "1d20 [17] +7": every die, then the flat parts. */
  detalle: string;
  /** The d20 that was kept, when the formula starts with one. */
  d20: number | null;
  /** Both d20s with advantage or disadvantage. */
  pair: [number, number] | null;
};

const TERM = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gi;

/** Whether `formula` is something this can roll: only dice and numbers. */
export function isFormula(formula: string): boolean {
  const clean = formula.replace(/\s+/g, "");
  if (!clean || !/d\d/i.test(clean)) return false;
  return /^([+-]?(\d*d\d+|\d+))+$/i.test(clean);
}

export function rollFormula(formula: string, mode: RollMode = "normal", roll: (sides: number) => number = rollDie): RollResult {
  const clean = formula.replace(/\s+/g, "").replace(/−/g, "-");
  let total = 0;
  let d20: number | null = null;
  let pair: [number, number] | null = null;
  const parts: string[] = [];
  let first = true;

  for (const match of clean.matchAll(TERM)) {
    const sign = match[1] === "-" ? -1 : 1;
    if (match[3]) {
      const count = Math.min(100, Number(match[2] || 1));
      const sides = Math.max(1, Math.min(1000, Number(match[3])));
      let dice = Array.from({ length: count }, () => roll(sides));
      if (first && sides === 20 && count === 1 && mode !== "normal") {
        const other = roll(20);
        pair = [dice[0]!, other];
        dice = [mode === "ventaja" ? Math.max(...pair) : Math.min(...pair)];
      }
      if (first && sides === 20 && count === 1) d20 = dice[0]!;
      first = false;
      total += sign * dice.reduce((sum, value) => sum + value, 0);
      parts.push(`${match[1] === "-" ? "-" : parts.length ? "+" : ""}${count}d${sides} [${dice.join(", ")}]`);
    } else if (match[4]) {
      total += sign * Number(match[4]);
      parts.push(`${match[1] === "-" ? "-" : "+"}${match[4]}`);
    }
  }
  return { total, detalle: parts.join(" "), d20, pair };
}
