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
 *
 * The same steppers serve **a mano**, which had no screen at all: it drew the
 * binding board with an empty pool, so it read "todavia no hay puntajes que
 * repartir" and offered six slots that could not be clicked. Four methods were
 * advertised and two of them worked. Manual is the same six rows without a
 * budget — no ceiling of 15, no cost per point, nothing to run out of — which
 * is what "whatever the table agreed on" means.
 */

import { motion } from "framer-motion";

import RuleNote from "@/components/ui/RuleNote";

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

/** What the payload accepts, which is manual's only bound. */
const MANUAL_MIN = 1;
const MANUAL_MAX = 30;

export default function PointBuy({
  scores,
  bonuses,
  accent,
  onChange,
  mode = "pointbuy",
}: {
  scores: Record<AbilityId, number>;
  /** The species or background bonus, shown but not spent. */
  bonuses: Partial<Record<AbilityId, number>>;
  accent: string;
  onChange: (ability: AbilityId, score: number) => void;
  /** Manual drops the budget and its ceiling; the rows are the same. */
  mode?: "pointbuy" | "manual";
}) {
  const buying = mode === "pointbuy";
  const spent = pointBuySpent(scores);
  const left = POINT_BUY_BUDGET - spent;

  return (
    <div>
      {buying ? (
      <div className="mb-6 flex items-baseline justify-between border-b border-iron/40 pb-4">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-bone/75">
            Puntos sin gastar
          </p>
          <RuleNote title="Compra de puntos">
            <p>
              Los puntajes van de {POINT_BUY_MIN} a {POINT_BUY_MAX} antes de los bonus.
            </p>
            <p>
              Subir de 13 a 14 y de 14 a 15 cuesta el doble, que es por lo que repartir suele
              rendir mas que apilar.
            </p>
          </RuleNote>
        </div>
        <p className="font-display text-3xl font-black" style={{ color: left < 0 ? "#C85028" : accent }}>
          {left}
          <span className="ml-1 font-mono text-xs font-normal text-bone/60">/ {POINT_BUY_BUDGET}</span>
        </p>
      </div>
      ) : (
        <div className="mb-6 border-b border-iron/40 pb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-bone/75">
            Los seis numeros
          </p>
          <p className="mt-1 font-body text-[13px] text-bone/60">
            Sin presupuesto y sin tope de 15. Escribi lo que tu mesa acordo.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {ABILITY_IDS.map((ability) => {
          const score = scores[ability];
          const bonus = bonuses[ability] ?? 0;
          const final = score + bonus;

          /*
           * Manual's only ceiling is the one the payload refuses.
           *
           * The schema takes a final score of 1 to 30, and final is what it
           * checks — so the base stops where the bonus would carry it past 30
           * rather than at a flat 30, which would let a dwarf seal a 32 and be
           * told so only at the very end.
           */
          const up = buying ? canRaise(scores, ability) : final < MANUAL_MAX;
          const down = buying ? canLower(scores, ability) : score > MANUAL_MIN;
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
                <p className="font-body text-[11px] text-bone/60">{abilityLabels[ability]}</p>
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
                {...(buying
                  ? {
                      note:
                        score < POINT_BUY_MAX
                          ? `${step} ${step === 1 ? "punto" : "puntos"}`
                          : `tope ${POINT_BUY_MAX}`,
                    }
                  : {})}
              />

              <div className="ml-auto flex items-baseline gap-3 text-right">
                {bonus > 0 && (
                  <span className="font-mono text-[10px] text-ember">+{bonus} de especie</span>
                )}
                <span className="w-8 font-display text-lg font-bold text-bone/70">{final}</span>
                <span className="w-7 font-mono text-[10px] text-bone/60">
                  {signed(modifierOf(final))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

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
      {note && <span className="mt-1 font-mono text-[10px] text-bone/60">{note}</span>}
    </div>
  );
}
