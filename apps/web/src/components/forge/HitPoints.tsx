/**
 * How this character got their hit points.
 *
 * Both editions print two ways on every class page — roll the hit die, or take
 * the fixed number the class states — and a table picks one. Until this panel
 * existed the builder could only average, so a player whose table rolls had a
 * number on their sheet that nobody had rolled and nowhere to correct it.
 *
 * Level 1 is shown and not asked: it is the die at maximum in both editions.
 * Showing it anyway is the shortest way to answer "why does the list start at
 * two" without a sentence of explanation.
 *
 * Each row carries its own die because a multiclass character's levels do: a
 * barbarian 1 / wizard 4 rolls four d6s, and a panel that asked for four d12s
 * would be inviting a number the character cannot have.
 */

import { useState } from "react";
import { motion } from "framer-motion";

import type { HitPointLevel } from "@/lib/hit-points";
import { DIVIDER, LABEL_MB4, WHISPER } from "@/styles/recipes";

export default function HitPoints({
  method,
  levels,
  firstDie,
  constitutionModifier,
  classLabel,
  accent,
  onPickMethod,
  onRoll,
}: {
  method: "average" | "rolled";
  /** Every level with a roll to record, which is every level after the first. */
  levels: HitPointLevel[];
  /** The die of the class taken at level 1, which is granted at maximum. */
  firstDie: number;
  constitutionModifier: number;
  classLabel: (classId: string) => string;
  accent: string;
  onPickMethod: (method: "average" | "rolled") => void;
  onRoll: (level: number, roll: number | null) => void;
}) {
  const [rolling, setRolling] = useState<number | null>(null);

  const roll = (row: HitPointLevel) => {
    setRolling(row.level);
    // Long enough to read as a throw rather than as a number appearing, short
    // enough that filling in nineteen levels is not a ceremony.
    window.setTimeout(() => {
      onRoll(row.level, 1 + Math.floor(Math.random() * row.die));
      setRolling(null);
    }, 260);
  };

  const signed = (value: number) => (value >= 0 ? `+${value}` : String(value));
  const unrolled = levels.filter((row) => row.roll === null).length;

  return (
    <div className={DIVIDER}>
      <p className={LABEL_MB4}>Puntos de golpe</p>

      <div className="mb-6 flex gap-2">
        {(
          [
            ["average", "Promedio", "el numero fijo que imprime la clase"],
            ["rolled", "Tirada", "lo que salio en la mesa"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPickMethod(value)}
            title={hint}
            className="flex-1 border px-4 py-3 text-left transition-colors"
            style={{
              borderColor: method === value ? accent : "rgba(120,113,108,0.4)",
              color: method === value ? accent : "rgba(232,226,214,0.5)",
            }}
          >
            <span className="font-display text-sm font-bold">{label}</span>
            <span className="mt-1 block font-body text-xs text-bone/35">{hint}</span>
          </button>
        ))}
      </div>

      {method === "average" ? (
        <p className={WHISPER}>
          Cada nivel despues del primero suma la mitad del dado mas uno. El primero es el dado al
          maximo, d{firstDie} {signed(constitutionModifier)}.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border-b border-iron/30 pb-2">
            <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.25em] text-bone/30">
              Nv 1
            </span>
            <span className="font-body text-sm text-bone/40">
              d{firstDie} al maximo — no se tira en ninguna de las dos ediciones
            </span>
          </div>

          {levels.map((row) => (
            <div key={row.level} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.25em] text-bone/30">
                Nv {row.level}
              </span>
              <span className="w-14 shrink-0 font-mono text-[11px] text-bone/45">d{row.die}</span>
              <span className="min-w-0 flex-1 truncate font-body text-sm text-bone/35">
                {classLabel(row.classId)}
              </span>

              <input
                type="number"
                min={1}
                max={row.die}
                value={row.roll ?? ""}
                placeholder={String(row.average)}
                onChange={(event) => {
                  const written = Number(event.target.value);
                  // An empty box is not a zero: it is a level nobody has rolled
                  // yet, and that level takes the average.
                  onRoll(
                    row.level,
                    event.target.value === "" || !Number.isFinite(written) ? null : written,
                  );
                }}
                aria-label={`Tirada de nivel ${row.level}`}
                className="w-16 border border-iron/40 bg-transparent px-2 py-1 text-center font-mono text-sm text-bone/80"
              />

              <motion.button
                type="button"
                onClick={() => roll(row)}
                animate={rolling === row.level ? { rotate: [0, 180, 360] } : { rotate: 0 }}
                transition={{ duration: 0.26 }}
                className="shrink-0 border border-iron/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50 hover:text-bone/80"
              >
                Tirar
              </motion.button>
            </div>
          ))}

          {unrolled > 0 && (
            <p className={`pt-3 ${WHISPER}`}>
              {unrolled === 1 ? "Queda un nivel sin tirar" : `Quedan ${unrolled} niveles sin tirar`}
              . Esos toman el promedio hasta que escribas lo que salio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
