/**
 * Binding six loose scores onto the six abilities.
 *
 * The dice — or the standard array — produce six numbers with no names on
 * them; this is where they get one. Pick a loose score, then pick the ability
 * it belongs to. Click a bound slot with nothing picked to release it.
 *
 * Two clicks rather than one, and deliberately. This used to bind whatever
 * you clicked to `nextOpen`, the first free slot in fixed order, which meant
 * a player who wanted their 15 in Charisma had to fill Strength, Dexterity,
 * Constitution, Intelligence and Wisdom first and then unpick them. The order
 * the dice fell in is not the order anyone builds in.
 *
 * The slots write straight onto the draft's `str`..`cha`, which are the raw
 * scores the rules layer treats as `base`. Species bonuses, improvements and
 * half-feats are added downstream, which is why a slot showing 15 can appear
 * on the Living Record as 17.
 */

import { useState } from "react";
import { motion } from "framer-motion";

import type { AbilityId } from "@/lib/abilities";
import { ABILITY_IDS, abilityLabels } from "@/lib/abilities";
import { WHISPER } from "@/styles/recipes";

const modifierOf = (score: number) => Math.floor((score - 10) / 2);

export default function StatRune({
  pool,
  bound,
  scores,
  accent,
  onBind,
  onRelease,
}: {
  /** Rolled scores not yet given a name. */
  pool: number[];
  /** Which abilities currently hold a bound score. */
  bound: ReadonlySet<AbilityId>;
  scores: Record<AbilityId, number>;
  accent: string;
  onBind: (ability: AbilityId, value: number) => void;
  onRelease: (ability: AbilityId) => void;
}) {
  /*
   * Which loose score is waiting for a home, by position in the pool.
   *
   * By index and not by value: a pool of 15, 14, 14, 12, 10, 8 holds two
   * fourteens, and picking one has to mean picking that one.
   */
  const [held, setHeld] = useState<number | null>(null);
  const heldValue = held !== null ? pool[held] : undefined;

  /** A slot click: place what is held, or release what is there. */
  function useSlot(ability: AbilityId) {
    if (heldValue !== undefined) {
      // Placing onto a full slot swaps: the old score goes back to the pool,
      // which is what a player expects from dragging one number onto another.
      if (bound.has(ability)) onRelease(ability);
      onBind(ability, heldValue);
      setHeld(null);
      return;
    }
    if (bound.has(ability)) onRelease(ability);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ---- the loose scores ---- */}
      <div>
        <p className="mb-4 font-mono text-[10px] tracking-[0.4em] uppercase text-bone/40">
          Puntajes sueltos
        </p>
        <div className="flex flex-wrap gap-4">
          {pool.map((value, index) => (
            <motion.button
              key={`${value}-${index}`}
              layout
              onClick={() => setHeld(held === index ? null : index)}
              whileHover={{ y: -4, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              title={held === index ? "Soltar" : "Elegir, y despues tocar una aptitud"}
              animate={
                held === index
                  ? { borderColor: accent, boxShadow: `0 0 22px ${accent}66` }
                  : { borderColor: "rgba(176,138,62,0.5)", boxShadow: "0 0 16px rgba(176,138,62,0.15)" }
              }
              className="flex h-14 w-14 select-none items-center justify-center border bg-ash font-display text-xl font-bold text-gold"
            >
              {value}
            </motion.button>
          ))}

          {pool.length === 0 && (
            <p className="font-body italic text-bone/30">
              {bound.size === ABILITY_IDS.length
                ? "Todo ligado. Las aptitudes tienen nombre."
                : "Todavia no hay puntajes que repartir."}
            </p>
          )}
        </div>

        {pool.length > 0 && (
          <p className="mt-4 font-body text-xs italic text-bone/30">
            {heldValue !== undefined ? (
              <>
                Tenes el <span style={{ color: accent }}>{heldValue}</span> en la mano. Toca la
                aptitud donde va.
              </>
            ) : (
              "Toca un puntaje para agarrarlo, y despues la aptitud donde lo queres."
            )}
          </p>
        )}
      </div>

      {/* ---- the slots ---- */}
      <div className="space-y-3">
        <p className="mb-4 font-mono text-[10px] tracking-[0.4em] uppercase text-bone/40">
          Ranuras de ligadura
        </p>
        {ABILITY_IDS.map((ability) => {
          const isBound = bound.has(ability);
          const score = scores[ability];

          return (
            <motion.button
              key={ability}
              onClick={() => useSlot(ability)}
              disabled={!isBound && heldValue === undefined}
              animate={
                // An open slot lights up while a score is held, so the place
                // the next click lands is visible before it lands.
                heldValue !== undefined && !isBound
                  ? { borderColor: `${accent}66`, boxShadow: `inset 0 0 20px ${accent}14` }
                  : isBound
                    ? { borderColor: `${accent}88`, boxShadow: `inset 0 0 24px ${accent}22` }
                    : { borderColor: "rgba(74,70,64,0.53)", boxShadow: "inset 0 0 0 transparent" }
              }
              className="flex w-full items-center justify-between border bg-ash/70 px-5 py-3 text-left backdrop-blur-sm disabled:cursor-default"
              title={
                heldValue !== undefined
                  ? `Poner ${heldValue} en ${abilityLabels[ability]}`
                  : isBound
                    ? "Soltar"
                    : "Sin ligar"
              }
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold tracking-[0.3em] text-bone/80">
                  {ability.toUpperCase()}
                </span>
                <span className={WHISPER}>
                  {abilityLabels[ability]}
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                {isBound && (
                  <span className="font-mono text-[10px] text-bone/40">
                    {modifierOf(score) >= 0 ? `+${modifierOf(score)}` : modifierOf(score)}
                  </span>
                )}
                <motion.span
                  key={isBound ? `v${score}` : "empty"}
                  initial={isBound ? { scale: 1.6, filter: "brightness(3)" } : false}
                  animate={{ scale: 1, filter: "brightness(1)" }}
                  transition={{ duration: 0.4 }}
                  className="w-8 text-right font-display text-2xl font-black"
                  style={{ color: isBound ? accent : "#4A4640" }}
                >
                  {isBound ? score : "—"}
                </motion.span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
