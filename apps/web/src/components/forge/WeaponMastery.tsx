/**
 * Which of the weapons the character has they have learned to use well.
 *
 * The weapon hands the mastery over, so this lists only weapons already in the
 * character's hands — the kit, the weapon they picked, the bag — and never a
 * catalogue to choose from. Each card says what mastering that weapon does
 * (Sap, Vex, Topple), and the count is how many the class lets them master.
 */

import { motion } from "framer-motion";

import type { MasteryOption, MasteryProblem } from "@/lib/weapon-mastery";
import { LABEL_MB2, WHISPER } from "@/styles/recipes";

export default function WeaponMastery({
  options,
  chosen,
  count,
  meleeOnly,
  problems,
  accent,
  onToggle,
}: {
  options: MasteryOption[];
  chosen: string[];
  count: number;
  meleeOnly: boolean;
  problems: MasteryProblem[];
  accent: string;
  onToggle: (id: string) => void;
}) {
  const taken = chosen.filter((id) => options.some((option) => option.id === id));
  const remaining = count - taken.length;

  return (
    <div>
      <p className={LABEL_MB2}>
        Maestria — <span style={{ color: accent }}>{taken.length}</span> de {count}
      </p>
      <p className={`mb-4 ${WHISPER}`}>
        {meleeOnly
          ? "Solo cuerpo a cuerpo: es lo que tu clase permite dominar."
          : "Dominas el tipo de arma, no el arma. Un mandoble magico usa la misma maestria que uno comun."}
      </p>

      {/* Said out loud rather than trimmed away. A pick that silently did not
          travel is the failure this builder keeps finding elsewhere. */}
      {problems.map((problem, index) => (
        <p key={index} className="mb-4 font-body text-[15px] text-ember">
          {problem.kind === "over-limit"
            ? `Elegiste ${problem.picked} y podes ${problem.allowed}: las de mas no viajan a la ficha.`
            : `${problem.itemId} no tiene maestria que dominar.`}
        </p>
      ))}

      {options.length === 0 && (
        <p className="font-body text-[15px] text-bone">
          Ninguna de tus armas tiene maestria todavia. La maestria la da el arma: suma una al
          equipo y aparece aca.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const picked = taken.includes(option.id);
          // Full is full: an unpicked option with no room left reads as
          // unavailable rather than silently doing nothing when clicked.
          const disabled = !picked && remaining < 1;

          return (
            <motion.button
              key={option.id}
              type="button"
              layout
              onClick={() => onToggle(option.id)}
              disabled={disabled}
              {...(disabled ? {} : { whileTap: { scale: 0.97 } })}
              className="border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30"
              style={{ borderColor: picked ? accent : `${accent}33` }}
              aria-pressed={picked}
              title={disabled ? "Ya elegiste todas las que podes dominar" : option.mastery}
            >
              <span
                className="block font-body text-[15px]"
                style={{ color: picked ? accent : undefined }}
              >
                {picked ? "✓ " : ""}
                {option.label}
              </span>
              <span className="block font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                {option.mastery}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
