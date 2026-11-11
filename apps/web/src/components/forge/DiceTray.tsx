/**
 * Three throws of 4d6-drop-lowest, and the player keeps one.
 *
 * One throw and live with it is not how any table rolls: everyone re-rolls a
 * spread that came out unplayable. Three is the common house rule and it is
 * what the sheet offers, with all three left on screen so the choice is made
 * by looking rather than by remembering.
 *
 * Each set shows the sum of its modifiers, which is the one number that
 * compares two spreads without reading twelve. It does not say which is
 * better — a 17 and five dumps beats a flat 13 for some builds and loses for
 * others — only what each adds up to.
 */

import { useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import RuleNote from "@/components/ui/RuleNote";
import { rollStatArray } from "@/lib/dice";
import { ROLL_ATTEMPTS, spreadWorth } from "@/lib/stat-methods";

export default function DiceTray({
  onRoll,
  sets,
  onKeep,
  accent,
}: {
  onRoll: (stats: number[]) => void;
  /** The throws so far, oldest first. */
  sets: number[][];
  onKeep: (index: number) => void;
  accent: string;
}) {
  const [rolls, setRolls] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const shake = useAnimationControls();

  const left = ROLL_ATTEMPTS - sets.length;

  const roll = () => {
    if (rolling || left <= 0) return;
    setRolling(true);
    const result = rollStatArray();

    // Screen shake at impact moment
    setTimeout(() => {
      shake.start({
        x: [0, -10, 8, -5, 3, 0],
        y: [0, 4, -4, 2, 0],
        transition: { duration: 0.45 },
      });
    }, 750);

    setTimeout(() => {
      setRolls(result);
      onRoll(result);
      setRolling(false);
    }, 950);
  };

  return (
    <motion.div animate={shake} className="relative">
      {/* Ember flash on impact */}
      {rolling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="pointer-events-none absolute inset-0 z-10"
          style={{ background: "radial-gradient(circle at center, rgba(255,90,31,0.3), transparent 60%)" }}
        />
      )}

      <div className="border border-[#5A5A5A]/60 bg-[#0B0B0B]/80 p-8 backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-mono text-[13px] tracking-[0.1em] uppercase text-gold">
            Rito de aptitudes
          </p>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[13px] tracking-widest uppercase text-bone">
              4d6 · descarta el menor
            </p>
            <RuleNote title="La suma de modificadores">
              <p>
                Compara dos tiradas de un vistazo, pero no dice cual es mejor: un 17 con cinco
                huecos le gana a un reparto parejo en algunos personajes y le pierde en otros.
              </p>
            </RuleNote>
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative">
              {/* Die body — angular, not a circle */}
              <motion.div
                animate={
                  rolling
                    ? {
                        rotateX: [0, 360 * (1 + i * 0.2)],
                        rotateY: [0, 360 * (1 + (5 - i) * 0.2)],
                        scale: [1, 1.15, 1],
                      }
                    : {}
                }
                transition={{ duration: 0.85, ease: [0.34, 1.56, 0.64, 1], delay: i * 0.04 }}
                style={{ transformStyle: "preserve-3d" }}
                className={`flex h-16 w-16 items-center justify-center border font-num text-2xl font-bold ${
                  rolling || !rolls[i]
                    ? "border-[#5A5A5A] text-transparent"
                    : "border-[#F2C14E]/70 bg-[#F2C14E]/[0.06] text-[#F2C14E]"
                }`}
              >
                {!rolling && rolls[i] ? rolls[i] : ""}
                {/* corner notches */}
                <span className={`absolute left-0 top-0 h-2 w-2 border-l border-t ${rolling ? "border-[#5A5A5A]" : "border-[#F2C14E]"}`} />
                <span className={`absolute right-0 bottom-0 h-2 w-2 border-b border-r ${rolling ? "border-[#5A5A5A]" : "border-[#F2C14E]"}`} />
              </motion.div>
            </div>
          ))}
        </div>

        <button
          onClick={roll}
          disabled={rolling || left <= 0}
          className="group relative mt-8 w-full overflow-hidden border border-[#6E0F0F]/70 bg-[#6E0F0F]/15 py-4 font-display text-sm font-semibold uppercase tracking-[0.1em] text-[#FFFFFF] transition-all hover:bg-[#6E0F0F]/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          {rolling ? (
            <span className="font-mono tracking-[0.1em]">los huesos ruedan…</span>
          ) : left > 0 ? (
            `Tirar los huesos · ${left} ${left === 1 ? "tirada" : "tiradas"}`
          ) : (
            "Sin tiradas. Quedate con una."
          )}
        </button>

        {/* ---- the throws so far ---- */}
        <AnimatePresence>
          {sets.length > 0 && !rolling && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 border-t border-[#5A5A5A]/50 pt-6"
            >
              <p className="mb-4 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                Elegi una
              </p>

              <div className="space-y-2">
                {sets.map((set, index) => {
                  const worth = spreadWorth(set);
                  return (
                    <button
                      key={index}
                      onClick={() => onKeep(index)}
                      className="flex w-full items-center gap-4 border border-[#5A5A5A]/50 bg-[#0B0B0B]/60 px-4 py-3 text-left transition-colors hover:border-[#F2C14E]"
                    >
                      <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                        Tirada {index + 1}
                      </span>

                      <span className="flex flex-wrap gap-2">
                        {[...set]
                          .sort((a, b) => b - a)
                          .map((score, position) => (
                            <span
                              key={`${score}-${position}`}
                              className="flex h-8 w-8 items-center justify-center border border-[#5A5A5A] font-num text-[15px] font-bold"
                              style={{ color: accent }}
                            >
                              {score}
                            </span>
                          ))}
                      </span>

                      <span className="ml-auto shrink-0 text-right font-mono text-[13px] text-bone">
                        modificadores {worth >= 0 ? `+${worth}` : worth}
                      </span>
                    </button>
                  );
                })}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
