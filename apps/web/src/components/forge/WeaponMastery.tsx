/**
 * The character's weapons, and which of them they have learned to use well.
 *
 * One list, not two: a player who has chosen the weapon they carry should not
 * be asked again, in another section, which weapons they master. Each weapon
 * is a card that says what it does (Sap, Vex, Topple); the card's main button
 * masters it and a small one under it makes it the weapon the character
 * carries.
 *
 * Shown as the weapons themselves rather than as the properties, because that
 * is the choice the book asks for: you master a longsword, and Sap is what
 * mastering it does.
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
  carriedId = "",
  onCarry,
}: {
  options: MasteryOption[];
  chosen: string[];
  count: number;
  meleeOnly: boolean;
  problems: MasteryProblem[];
  accent: string;
  onToggle: (id: string) => void;
  /** The dnd5e id of the weapon the character carries, or "". */
  carriedId?: string;
  /** Make this weapon the one the character carries. */
  onCarry?: (id: string) => void;
}) {
  const taken = chosen.filter((id) => options.some((option) => option.id === id));
  const remaining = count - taken.length;

  return (
    <div>
      <p className={LABEL_MB2}>
        Armas — dominas <span style={{ color: accent }}>{taken.length}</span> de {count}
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

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const picked = taken.includes(option.id);
          // Full is full: an unpicked option with no room left reads as
          // unavailable rather than silently doing nothing when clicked.
          const disabled = !picked && remaining < 1;
          const carried = option.id === carriedId;

          return (
            <div
              key={option.id}
              className="flex flex-col border"
              style={{ borderColor: picked || carried ? accent : `${accent}33` }}
            >
              <motion.button
                type="button"
                layout
                onClick={() => onToggle(option.id)}
                disabled={disabled}
                {...(disabled ? {} : { whileTap: { scale: 0.97 } })}
                className="px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                aria-pressed={picked}
                title={disabled ? "Ya elegiste todas las que podes dominar" : `Dominar: ${option.mastery}`}
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
              {onCarry && (
                <button
                  type="button"
                  onClick={() => onCarry(option.id)}
                  aria-pressed={carried}
                  className="border-t px-3 py-1 text-left font-mono text-[13px] uppercase tracking-[0.1em] transition-colors hover:text-bone"
                  style={{ borderColor: `${accent}33`, color: carried ? accent : "rgba(230,223,206,0.6)" }}
                >
                  {carried ? "La llevas" : "Llevar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
