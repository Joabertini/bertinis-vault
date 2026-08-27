/**
 * Twenty-seven points, spent across six abilities.
 *
 * The screen the majority of tables actually use, and the one this front did
 * not have — a player who buys points had to roll dice and then talk them into
 * the spread they wanted.
 *
 * What it shows that a plain stepper would not is the **cost of the next
 * point**, because that is the only interesting thing about point buy. Going
 * from 13 to 14 costs two, and from 14 to 15 costs two more; everything below
 * costs one. Those two jumps are why spreading beats dumping, and a player who
 * cannot see them is choosing blind.
 *
 * The scores here are before any species bonus. A 15 bought here is a 17 on
 * the Living Record once a +2 lands on it, and that is the number worth
 * planning around — so the racial bonus is shown alongside rather than left
 * for the player to add in their head.
 */

import { motion } from "framer-motion";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "@/lib/abilities";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  canLower,
  canRaise,
  pointBuyCost,
  pointBuySpent,
} from "@/lib/stat-methods";

const modifierOf = (score: number) => Math.floor((score - 10) / 2);
const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

export default function PointBuy({
  scores,
  bonuses,
  accent,
  onChange,
}: {
  scores: Record<AbilityId, number>;
  /** The species or background bonus, shown but not spent. */
  bonuses: Partial<Record<AbilityId, number>>;
  accent: string;
  onChange: (ability: AbilityId, score: number) => void;
}) {
  const spent = pointBuySpent(scores);
  const left = POINT_BUY_BUDGET - spent;

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between border-b border-iron/40 pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-bone/40">
          Puntos sin gastar
        </p>
        <p className="font-display text-3xl font-black" style={{ color: left < 0 ? "#C85028" : accent }}>
          {left}
          <span className="ml-1 font-mono text-xs font-normal text-bone/30">/ {POINT_BUY_BUDGET}</span>
        </p>
      </div>

      <div className="space-y-2">
        {ABILITY_IDS.map((ability) => {
          const score = scores[ability];
          const bonus = bonuses[ability] ?? 0;
          const final = score + bonus;

          const up = canRaise(scores, ability);
          const down = canLower(scores, ability);
          // What the next point costs, which is the number point buy is about.
          const step = (pointBuyCost(score + 1) ?? 0) - (pointBuyCost(score) ?? 0);

          return (
            <div
              key={ability}
              className="flex items-center gap-4 border border-iron/40 bg-ash/60 px-4 py-2.5"
            >
              <div className="w-28 shrink-0">
                <p className="font-display text-sm font-semibold tracking-[0.25em] text-bone/80">
                  {ability.toUpperCase()}
                </p>
                <p className="font-body text-[11px] italic text-bone/30">{abilityLabels[ability]}</p>
              </div>

              <Step label="−" enabled={down} onClick={() => onChange(ability, score - 1)} />

              <motion.span
                key={score}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="w-8 text-center font-display text-2xl font-black"
                style={{ color: accent }}
              >
                {score}
              </motion.span>

              <Step
                label="+"
                enabled={up}
                onClick={() => onChange(ability, score + 1)}
                note={
                  score < POINT_BUY_MAX
                    ? `${step} ${step === 1 ? "punto" : "puntos"}`
                    : `tope ${POINT_BUY_MAX}`
                }
              />

              <div className="ml-auto flex items-baseline gap-3 text-right">
                {bonus > 0 && (
                  <span className="font-mono text-[10px] text-ember/70">+{bonus} de especie</span>
                )}
                <span className="w-8 font-display text-lg font-bold text-bone/70">{final}</span>
                <span className="w-7 font-mono text-[10px] text-bone/35">
                  {signed(modifierOf(final))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 font-body text-xs italic leading-relaxed text-bone/35">
        Los puntajes van de {POINT_BUY_MIN} a {POINT_BUY_MAX} antes de los bonus. Subir de 13 a 14 y
        de 14 a 15 cuesta el doble, que es por lo que repartir suele rendir mas que apilar.
      </p>
    </div>
  );
}

function Step({
  label,
  enabled,
  onClick,
  note,
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  /** What the step costs. Only worth showing on the way up. */
  note?: string;
}) {
  return (
    <div className="flex w-16 flex-col items-center">
      <button
        onClick={onClick}
        disabled={!enabled}
        className="h-8 w-8 border border-iron/60 bg-void/50 font-display text-lg leading-none text-bone/70 transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-iron/60 disabled:hover:text-bone/70"
        aria-label={label === "+" ? "Subir" : "Bajar"}
      >
        {label}
      </button>
      {note && <span className="mt-1 font-mono text-[8px] text-bone/25">{note}</span>}
    </div>
  );
}
