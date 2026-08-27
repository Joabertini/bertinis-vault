/**
 * The class's own picks: styles, invocations, metamagic, maneuvers.
 *
 * One section per pool, each with its own count, because a warlock at level 3
 * is choosing two invocations *and* one pact boon and those are separate
 * questions.
 *
 * An option whose prerequisite is not met is shown greyed with the reason,
 * rather than hidden. Hiding it makes the list look arbitrary — a player who
 * knows Agonizing Blast exists and cannot find it assumes the app is broken,
 * where "Requiere conocer eldritch blast" tells them what to do.
 */

import { motion } from "framer-motion";

import type { TalentPool } from "@/lib/optional-features";
import { ITEM_META, ITEM_NAME, LABEL, META, WHISPER } from "@/styles/recipes";

export default function TalentPools({
  pools,
  chosen,
  accent,
  onToggle,
}: {
  pools: TalentPool[];
  chosen: string[];
  accent: string;
  onToggle: (id: string) => void;
}) {
  if (pools.length === 0) return null;

  const taken = new Set(chosen);

  return (
    <div className="space-y-10">
      {pools.map((pool) => {
        const inPool = pool.options.filter((option) => taken.has(option.id)).length;
        const full = inPool >= pool.count;

        return (
          <div key={pool.name}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <span className={LABEL}>
                {pool.name}
              </span>
              <span
                className={META}
                style={{ color: full ? accent : "rgba(230,223,206,0.35)" }}
              >
                {inPool} / {pool.count}
              </span>
            </div>

            <div className="grid max-h-80 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
              {pool.options.map((option) => {
                const active = taken.has(option.id);
                const disabled = (!option.eligible || (full && !active)) && !active;

                return (
                  <motion.button
                    key={`${option.id}:${option.source}`}
                    onClick={() => !disabled && onToggle(option.id)}
                    disabled={disabled}
                    {...(disabled ? {} : { whileTap: { scale: 0.98 } })}
                    className="flex flex-col items-start gap-1 border-l-2 px-4 py-2.5 text-left transition-colors disabled:cursor-not-allowed"
                    style={{
                      borderLeftColor: active ? accent : "transparent",
                      background: active ? `${accent}12` : "transparent",
                      opacity: disabled ? 0.35 : 1,
                    }}
                    title={option.blockedBy ?? undefined}
                  >
                    <div className="flex w-full items-baseline justify-between gap-3">
                      <span
                        className={ITEM_NAME}
                        style={{ color: active ? accent : "#E6DFCE" }}
                      >
                        {option.label}
                      </span>
                      <span className={ITEM_META}>
                        {option.source}
                      </span>
                    </div>

                    {option.blockedBy && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ember/60">
                        {option.blockedBy}
                      </span>
                    )}

                    {/* Prose prerequisites: shown, never enforced. */}
                    {option.notes.map((note) => (
                      <span key={note} className={WHISPER}>
                        {note}
                      </span>
                    ))}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
