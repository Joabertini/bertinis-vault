/**
 * Spending a budget of points across the six abilities.
 *
 * Used for the species increase and for each level's improvement, which are
 * the same interaction with different budgets and caps.
 *
 * The cap is enforced against the score the point lands on, not against the
 * bonus in isolation: two points into a 19 makes a 21, which the schema
 * refuses, so the stepper stops at 20 rather than letting the export fail
 * later.
 */

import { motion } from "framer-motion";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "@/lib/abilities";
import { META } from "@/styles/recipes";

export default function BonusEditor({
  bonuses,
  scoresBefore,
  budget,
  maxPerAbility,
  scoreCap = 20,
  allowed = null,
  accent,
  onChange,
}: {
  bonuses: Partial<Record<AbilityId, number>>;
  /** What each score is before this editor's points are added. */
  scoresBefore: Record<AbilityId, number>;
  budget: number;
  maxPerAbility: number;
  scoreCap?: number;
  /**
   * The abilities this increase may go into, or null when any may.
   *
   * 2024 backgrounds name three. The others are shown rather than hidden — a
   * player who cannot find Strength assumes the app lost it, where a Strength
   * that plainly will not take a point says the background decided that.
   */
  allowed?: AbilityId[] | null;
  accent: string;
  onChange: (next: Partial<Record<AbilityId, number>>) => void;
}) {
  const spent = ABILITY_IDS.reduce((sum, ability) => sum + (bonuses[ability] ?? 0), 0);
  const left = budget - spent;

  const permitted = allowed ? new Set(allowed) : null;
  const mayTake = (ability: AbilityId) => !permitted || permitted.has(ability);

  const step = (ability: AbilityId, delta: number) => {
    /*
     * What the background forbids is *taking*, never giving back.
     *
     * Refusing both directions is how a draft got stuck: a 2024 character
     * seeded with a spread its background does not name held points in
     * abilities the editor would not let it lower, so the panel sat over
     * budget with no move that reduced it. Whatever the reason a point is
     * somewhere it should not be, removing it is always a legal answer.
     */
    if (delta > 0 && !mayTake(ability)) return;
    const current = bonuses[ability] ?? 0;
    const next = current + delta;

    if (next < 0 || next > maxPerAbility) return;
    if (delta > 0 && left <= 0) return;
    if (delta > 0 && scoresBefore[ability] + next > scoreCap) return;

    const updated = { ...bonuses };
    if (next === 0) delete updated[ability];
    else updated[ability] = next;

    onChange(updated);
  };

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
          Puntos
        </span>
        <span
          className={META}
          style={{ color: left === 0 ? accent : "#FF7043" }}
        >
          {spent} / {budget}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ABILITY_IDS.map((ability) => {
          const amount = bonuses[ability] ?? 0;
          const before = scoresBefore[ability];
          const after = before + amount;
          const atCap = after >= scoreCap;
          const open = mayTake(ability);

          return (
            <div
              key={ability}
              className="flex items-center justify-between gap-2 border px-3 py-2"
              style={{
                borderColor: amount > 0 ? `${accent}66` : "rgba(74,70,64,0.5)",
                background: amount > 0 ? `${accent}0d` : "transparent",
                opacity: open ? 1 : 0.35,
              }}
            >
              <div className="min-w-0">
                <p
                  className="font-display text-sm font-bold tracking-[0.1em]"
                  style={{ color: amount > 0 ? accent : "#FFFFFF" }}
                >
                  {ability.toUpperCase()}
                </p>
                <p className="truncate font-mono text-[13px] text-bone">
                  {before}
                  {amount > 0 && (
                    <>
                      {" → "}
                      <span style={{ color: accent }}>{after}</span>
                    </>
                  )}
                  {!open && " · no la ofrece tu trasfondo"}
                  {open && atCap && amount === 0 && " · tope"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Stepper label="−" onClick={() => step(ability, -1)} disabled={amount === 0} />
                <motion.span
                  key={amount}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  className="w-5 text-center font-num text-[15px] font-bold"
                  style={{ color: amount > 0 ? accent : "#5A5A5A" }}
                >
                  {amount > 0 ? `+${amount}` : "—"}
                </motion.span>
                <Stepper
                  label="+"
                  onClick={() => step(ability, 1)}
                  disabled={left <= 0 || amount >= maxPerAbility || after >= scoreCap}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-6 w-6 border border-iron/70 font-mono text-sm text-bone transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:border-iron/70 disabled:hover:text-bone"
      aria-label={label === "+" ? "Sumar" : "Restar"}
    >
      {label}
    </button>
  );
}
