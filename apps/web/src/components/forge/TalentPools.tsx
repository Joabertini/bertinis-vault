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

import { unmetTalents, type TalentPool } from "@/lib/optional-features";
import { ITEM_META, ITEM_NAME, LABEL, LABEL_MB2, META, WHISPER } from "@/styles/recipes";

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
  /*
   * Picks that were legal when they were made and are not any more — a swapped
   * pact boon, a dropped cantrip. The greying in the list below only covers the
   * moment of choosing; nothing else would ever mention these again.
   */
  const stale = unmetTalents(pools, chosen);

  return (
    <div className="space-y-10">
      {stale.length > 0 && (
        <div className="border-l-2 border-ember/50 pl-4">
          <p className={LABEL_MB2}>Ya no cumplen su requisito</p>
          <ul className="space-y-1">
            {stale.map((entry) => (
              <li key={entry.id} className="font-body text-sm text-ember">
                {entry.label} — {entry.reason}
              </li>
            ))}
          </ul>
          <p className={`mt-2 ${WHISPER}`}>Siguen elegidos: sacarlos es tu decision.</p>
        </div>
      )}
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
                style={{ color: full ? accent : "rgba(230,223,206,0.6)" }}
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
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ember">
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
