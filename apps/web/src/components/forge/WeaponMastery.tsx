/**
 * The weapons this character has learned to use well.
 *
 * Shown as the weapons themselves rather than as the properties, because that
 * is the choice the book asks for: you master a longsword, and Sap is what
 * mastering it does. A player scanning a list of eight property names has to
 * work backwards to find which weapon carries the one they want.
 *
 * The property is printed beside each weapon anyway — it is the reason to pick
 * one over another, and hiding it would make the list eight kinds of the same
 * decision.
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
        <p key={index} className="mb-4 font-body text-xs italic text-ember/70">
          {problem.kind === "over-limit"
            ? `Elegiste ${problem.picked} y podes ${problem.allowed}: las de mas no viajan a la ficha.`
            : `${problem.itemId} no tiene maestria que dominar.`}
        </p>
      ))}

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
              title={disabled ? "Ya elegiste todas las que podes dominar" : option.mastery}
            >
              <span
                className="block font-body text-sm"
                style={{ color: picked ? accent : undefined }}
              >
                {option.label}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-bone/30">
                {option.mastery}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
