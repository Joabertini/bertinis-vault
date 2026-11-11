import { sizeNameOf } from "@/lib/table-numbers";
import { DIVIDER_TIGHT, LABEL, WHISPER } from "@/styles/recipes";

/**
 * The size question, for the thirty species that ask it.
 *
 * Drawn as buttons and not as a fact, because it is a question: the 2024
 * human, aasimar and tiefling and twenty-seven more print `["S","M"]` and
 * leave the choice to the player. Reading that as Small — which is what
 * taking the first letter did — sent every one of them to the table in a
 * Small square carrying half the weight.
 *
 * Pressing the chosen one again clears it, and unanswered is a legal state:
 * the field simply does not travel, and Foundry reads an absent size as
 * Medium. So the note says what silence will mean rather than barring the way.
 */
export default function SizeChoice({
  options,
  value,
  accent,
  onPick,
}: {
  options: string[];
  value: string;
  accent: string;
  onPick: (letter: string) => void;
}) {
  return (
    <div className={DIVIDER_TIGHT}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className={LABEL}>Tamano</span>
        <span className={WHISPER}>Esta especie se juega en dos tamanos.</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {options.map((letter) => {
          const chosen = letter === value;

          return (
            <button
              key={letter}
              type="button"
              aria-pressed={chosen}
              onClick={() => onPick(chosen ? "" : letter)}
              className="border px-3 py-1.5 font-body text-[15px] transition-colors"
              style={
                chosen
                  ? { borderColor: accent, background: `${accent}1f`, color: accent }
                  : { borderColor: "rgba(74,70,64,0.7)", color: "#FFFFFF" }
              }
            >
              {sizeNameOf(letter)}
            </button>
          );
        })}
      </div>

      {!value && (
        <p className={`mt-4 ${WHISPER}`}>
          Sin elegir sale como Mediano, que es lo que Foundry entiende cuando no se dice nada.
        </p>
      )}
    </div>
  );
}
