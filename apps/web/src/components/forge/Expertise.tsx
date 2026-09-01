/**
 * Expertise: the proficiencies this character doubles.
 *
 * Shown as one block per grant rather than one long list, because a rogue
 * answers the same question twice — at level 1 and again at level 6 — and the
 * second answer may not repeat the first. Merging them into one list of four
 * picks would let the player spend both grants on the same two skills and
 * think they had doubled four.
 *
 * A grant that names what it doubles is stated rather than asked. The scout's
 * Survivalist doubles Nature and Survival and offers nothing to decide; making
 * that a question with one answer wastes the player's attention.
 */

import type { ExpertiseProblem } from "@bertinis-vault/domain";

import type { ExpertiseSlot } from "@/lib/expertise";
import RuleNote from "@/components/ui/RuleNote";
import { LABEL, WHISPER } from "@/styles/recipes";

/** A problem, said the way a player would say it. */
function problemLine(problem: ExpertiseProblem): string {
  switch (problem.kind) {
    case "unchosen":
      return "Falta elegir como gastarlo.";
    case "unspent":
      return `Te queda ${problem.allowed - problem.picked} por elegir.`;
    case "overspent":
      return `Elegiste ${problem.picked} y podes ${problem.allowed}.`;
    case "not-proficient":
      return `No tenes competencia en ${problem.id}: la maestria dobla una competencia, no la otorga.`;
    case "duplicate":
      return `${problem.id} ya esta doblado, y doblarlo dos veces no suma.`;
    case "no-such-set":
      return "La opcion guardada ya no existe.";
    default:
      return "";
  }
}

export default function Expertise({
  slots,
  proficientSkills,
  proficientTools,
  accent,
  onAnswer,
}: {
  slots: ExpertiseSlot[];
  proficientSkills: string[];
  proficientTools: string[];
  accent: string;
  onAnswer: (key: string, setIndex: number, of: "skills" | "tools", id: string) => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <p className={LABEL}>Maestria</p>
        <RuleNote title="Maestria">
          <p>
            Doblas el bono de competencia en lo que ya sabes hacer. Es el unico multiplicador
            sobre una tirada de d20 en todo el juego.
          </p>
        </RuleNote>
      </div>

      {slots.map((slot) => {
        const answer = slot.answer;
        const set = slot.grant.sets[answer?.setIndex ?? 0];

        return (
          <div key={slot.key} className="mb-6 border border-iron/40 p-5">
            <p className="mb-1 font-display text-sm font-bold" style={{ color: accent }}>
              {slot.grant.name}
            </p>
            <p className={`mb-4 ${WHISPER}`}>
              {slot.from} · nivel {slot.grant.level}
            </p>

            {/* More than one way to spend it. The 2014 rogue may take two
                skills, or one skill and thieves' tools. */}
            {slot.grant.sets.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {slot.grant.sets.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onAnswer(slot.key, index, "skills", "")}
                    className="border px-3 py-1.5 font-body text-xs transition-colors"
                    style={{
                      borderColor: answer?.setIndex === index ? accent : `${accent}33`,
                      color: answer?.setIndex === index ? accent : undefined,
                    }}
                  >
                    {option.anySkill > 0 && `${option.anySkill} pericia${option.anySkill > 1 ? "s" : ""}`}
                    {option.anySkill > 0 && option.tools.length > 0 && " y "}
                    {option.tools.join(", ")}
                    {option.anyTool > 0 && `${option.anySkill > 0 ? " y " : ""}${option.anyTool} herramienta`}
                  </button>
                ))}
              </div>
            )}

            {/* What it doubles without asking. */}
            {set && (set.skills.length > 0 || set.tools.length > 0) && (
              <p className="mb-4 font-body text-sm text-bone/60">
                Dobla {[...set.skills, ...set.tools].join(", ")}.
              </p>
            )}

            {set && set.anySkill > 0 && (
              <Picker
                label={`Pericias — ${answer?.skills.length ?? 0} de ${set.anySkill}`}
                options={proficientSkills}
                chosen={answer?.skills ?? []}
                accent={accent}
                onPick={(id) => onAnswer(slot.key, answer?.setIndex ?? 0, "skills", id)}
              />
            )}

            {set && set.anyTool > 0 && (
              <Picker
                label={`Herramientas — ${answer?.tools.length ?? 0} de ${set.anyTool}`}
                options={proficientTools}
                chosen={answer?.tools ?? []}
                accent={accent}
                onPick={(id) => onAnswer(slot.key, answer?.setIndex ?? 0, "tools", id)}
              />
            )}

            {slot.problems.map((problem, index) => (
              <p key={index} className="mt-3 font-body text-[13px] text-ember">
                {problemLine(problem)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The pool, which is what the character is already proficient in.
 *
 * Empty when they hold none of that kind — a rogue who has not picked their
 * skills yet. Said out loud rather than shown as an empty row, because the fix
 * is in another chamber and the player has to know to go there.
 */
function Picker({
  label,
  options,
  chosen,
  accent,
  onPick,
}: {
  label: string;
  options: string[];
  chosen: string[];
  accent: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60">{label}</p>
      {options.length === 0 ? (
        <p className={WHISPER}>Todavia no tenes nada de esto en lo que doblar.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPick(option)}
              className="border px-3 py-1.5 font-body text-xs transition-colors"
              style={{
                borderColor: chosen.includes(option) ? accent : `${accent}33`,
                color: chosen.includes(option) ? accent : undefined,
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
