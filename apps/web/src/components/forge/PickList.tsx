/**
 * Choosing a bounded number of things from a list.
 *
 * Used for skills, languages and spells — all of which share the same shape:
 * pick exactly N, no more. The count is shown as "3 / 4" rather than only
 * disabling options at the limit, so a player can see how many they still owe
 * without counting ticks.
 *
 * Options already granted elsewhere are passed as `locked`: shown, marked, and
 * not selectable, because a background that already gave you Arcana has not
 * left you a choice about Arcana.
 */

import { motion } from "framer-motion";
import { LABEL, META, WHISPER_MB4 } from "@/styles/recipes";

export default function PickList({
  title,
  hint,
  options,
  selected,
  locked = [],
  limit,
  accent,
  onToggle,
  columns = 3,
}: {
  title: string;
  hint?: string;
  options: string[];
  selected: string[];
  /** Already true from another source. Rendered as such, never selectable. */
  locked?: string[];
  limit: number;
  accent: string;
  onToggle: (value: string) => void;
  columns?: 2 | 3;
}) {
  const lockedSet = new Set(locked);
  const chosen = selected.filter((entry) => !lockedSet.has(entry));
  const full = chosen.length >= limit;
  const complete = chosen.length === limit;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <span className={LABEL}>
          {title}
        </span>
        <span
          className={META}
          style={{ color: complete ? accent : "rgba(230,223,206,0.6)" }}
        >
          {chosen.length} / {limit}
        </span>
      </div>

      {hint && <p className={WHISPER_MB4}>{hint}</p>}

      <div
        className={`grid gap-1 ${columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {options.map((option) => {
          const isLocked = lockedSet.has(option);
          const isChosen = !isLocked && selected.includes(option);
          // A full list still lets you untick what you already chose.
          const disabled = isLocked || (full && !isChosen);

          return (
            <motion.button
              key={option}
              onClick={() => !disabled && onToggle(option)}
              disabled={disabled}
              {...(disabled ? {} : { whileTap: { scale: 0.97 } })}
              className="flex items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed"
              style={{
                borderLeftColor: isChosen || isLocked ? accent : "transparent",
                background: isChosen ? `${accent}12` : "transparent",
                opacity: disabled && !isLocked ? 0.3 : 1,
              }}
              title={isLocked ? "Ya otorgado" : undefined}
            >
              <span
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[13px]"
                style={{
                  borderColor: isChosen || isLocked ? accent : "#5A5A5A",
                  background: isLocked ? accent : "transparent",
                  color: "#0B0B0B",
                }}
              >
                {isLocked ? "✓" : isChosen ? <span style={{ color: accent }}>✦</span> : ""}
              </span>
              <span
                className="truncate font-body text-[15px]"
                style={{ color: isChosen ? accent : isLocked ? "rgba(230,223,206,0.75)" : "#FFFFFF" }}
              >
                {option}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
