/**
 * Which magic items the character is attuned to.
 *
 * The bag already marks an item as requiring attunement and then never asked,
 * so every magic item reached Foundry with the box unticked — which for most
 * of them means it does nothing at all.
 *
 * Shown only when there is something to attune to. A rope, a spellbook and
 * fifty feet of chain are the whole inventory of most level one characters,
 * and a panel reading "0 de 3" on every one of them is furniture.
 *
 * A fourth is allowed and named. Three is the rule, and a table that hands out
 * a fourth is making a ruling — a builder that deletes the pick is arguing
 * with it.
 */

import type { AttunementState } from "@bertinis-vault/domain";
import { LABEL_MB2, WHISPER } from "@/styles/recipes";

export default function Attunement({
  state,
  accent,
  onToggle,
}: {
  state: AttunementState;
  accent: string;
  onToggle: (id: string) => void;
}) {
  if (state.offered.length === 0) return null;

  const over = state.over > 0;

  return (
    <div>
      <p className={LABEL_MB2}>Sintonizacion</p>

      <p className="mb-3 font-body text-sm text-bone/60">
        <span style={{ color: over ? "#ff5a1f" : accent }}>{state.used}</span>
        <span className="text-bone/60"> de {state.slots}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        {state.offered.map((item) => {
          const on = state.attuned.some((entry) => entry.id === item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={on}
              className="border px-3 py-1.5 font-body text-sm transition-colors"
              style={{
                borderColor: on ? accent : "rgba(120,120,120,0.4)",
                color: on ? accent : "rgba(230,223,206,0.75)",
              }}
            >
              <span className="mr-1.5 font-mono text-[10px]">{on ? "◆" : "◈"}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {over && (
        <p className={`mt-3 ${WHISPER}`} style={{ color: "#ff5a1f" }}>
          Tres es el maximo. Llevas {state.used}.
        </p>
      )}
    </div>
  );
}
