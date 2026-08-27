export const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;

export function roll4d6DropLowest() {
  const rolls = Array.from({ length: 4 }, () => rollDie(6));
  // Ascending, so the lowest is the head: drop it and add up the rest. Summing
  // the tail rather than indices 1..3 says the rule out loud, and survives
  // `noUncheckedIndexedAccess` without asserting a length the type cannot see.
  const [, ...kept] = [...rolls].sort((a, b) => a - b);
  return { total: kept.reduce((sum, die) => sum + die, 0), rolls };
}

export function rollStatArray(): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest().total);
}
