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
import RuleNote from "@/components/ui/RuleNote";
import { DIVIDER, LABEL, WHISPER } from "@/styles/recipes";

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
      <div className="mb-4 flex items-center gap-3">
        <p className={LABEL}>Puntos de golpe</p>
        <RuleNote title="Puntos de golpe">
          <p>
            El nivel 1 es siempre el dado al maximo. Cada nivel despues suma la mitad del dado
            mas uno, o lo que salga si preferis tirarlo.
          </p>
          <p>A todos los niveles se les suma tu modificador de Constitucion.</p>
        </RuleNote>
      </div>

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
              color: method === value ? accent : "rgba(230,223,206,0.75)",
            }}
          >
            <span className="font-display text-[15px] font-bold">{label}</span>
            <span className="mt-1 block font-body text-sm text-bone">{hint}</span>
          </button>
        ))}
      </div>

      {method === "average" ? (
        <p className={WHISPER}>
          Nivel 1: d{firstDie} al maximo {signed(constitutionModifier)}.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border-b border-iron/30 pb-2">
            <span className="w-16 shrink-0 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
              Nv 1
            </span>
            <span className="font-body text-[15px] text-bone">
              d{firstDie} al maximo — no se tira en ninguna de las dos ediciones
            </span>
          </div>

          {levels.map((row) => (
            <div key={row.level} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                Nv {row.level}
              </span>
              <span className="w-14 shrink-0 font-mono text-[14px] text-bone">d{row.die}</span>
              <span className="min-w-0 flex-1 truncate font-body text-[15px] text-bone">
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
                className="w-16 border border-iron/40 bg-transparent px-2 py-1 text-center font-mono text-[15px] text-bone"
              />

              <motion.button
                type="button"
                onClick={() => roll(row)}
                animate={rolling === row.level ? { rotate: [0, 180, 360] } : { rotate: 0 }}
                transition={{ duration: 0.26 }}
                className="shrink-0 border border-iron/40 px-3 py-1 font-mono text-[13px] uppercase tracking-[0.1em] text-bone hover:text-bone"
              >
                Tirar
              </motion.button>
            </div>
          ))}

          {unrolled > 0 && (
            <p className={`pt-3 ${WHISPER}`}>
              {unrolled === 1 ? "Queda 1 nivel sin tirar" : `Quedan ${unrolled} niveles sin tirar`}
              : toman el promedio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
