import { featAbilityRequirement, type AbilityBonusMap } from "@bertinis-vault/domain";
import type { FeatAbilityGrant } from "@bertinis-vault/vetools-index";

const ABILITY_LABELS: Record<string, string> = {
  str: "FUE",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

type Props = {
  idPrefix: string;
  grants: FeatAbilityGrant[];
  bonuses: AbilityBonusMap;
  onChange: (bonuses: AbilityBonusMap) => void;
};

/**
 * The ability a half-feat raises.
 *
 * Renders nothing at all for the 116 feats that raise nothing, so the common
 * case costs the player no interaction and no visual noise. For the rest it is
 * one select per pick — almost always exactly one, "+1 to Intelligence, Wisdom
 * or Charisma".
 *
 * This is the half of a feat that was being lost. Until it existed, taking
 * Resilient left the score where it was and the sheet gave no sign that a point
 * had gone missing.
 */
export function FeatAbilityPicker({ idPrefix, grants, bonuses, onChange }: Props) {
  const { choices } = featAbilityRequirement(grants);
  if (choices.length === 0) return null;

  // One slot per pick. A grant of `count: 2` is two selects from the same pool,
  // which is how the 2024 improvement-as-a-feat spreads its points.
  const slots = choices.flatMap((choice, choiceIndex) =>
    Array.from({ length: choice.count }, (_, pick) => ({
      key: `${choiceIndex}-${pick}`,
      from: choice.from,
      amount: choice.amount,
    })),
  );

  const picked = Object.entries(bonuses)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([ability]) => ability);

  const setSlot = (slotIndex: number, ability: string) => {
    const next = [...picked];
    if (ability) next[slotIndex] = ability;
    else next.splice(slotIndex, 1);

    const merged: AbilityBonusMap = {};
    next.forEach((chosen, index) => {
      if (!chosen) return;
      const amount = slots[index]?.amount ?? 1;
      merged[chosen as keyof AbilityBonusMap] =
        (merged[chosen as keyof AbilityBonusMap] ?? 0) + amount;
    });

    onChange(merged);
  };

  return (
    <div className="array-row">
      {slots.map((slot, index) => (
        <select
          id={`${idPrefix}-ability-${slot.key}`}
          key={slot.key}
          onChange={(event) => setSlot(index, event.target.value)}
          value={picked[index] ?? ""}
        >
          <option value="">+{slot.amount} a &mdash;</option>
          {slot.from.map((ability) => (
            <option key={ability} value={ability}>
              +{slot.amount} a {ABILITY_LABELS[ability] ?? ability.toUpperCase()}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
