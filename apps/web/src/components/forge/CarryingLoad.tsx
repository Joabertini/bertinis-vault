/**
 * What the character is carrying, against what they can carry.
 *
 * A bar rather than a sentence, because the question a player asks here is
 * "how much room is left" and a bar answers it without being read.
 *
 * The encumbrance thresholds are marked on it and never enforced. They are an
 * optional variant most tables do not use, and a sheet that applied them would
 * be applying a rule the table did not adopt — but one that hid them would be
 * hiding the numbers the tables that do use it need. So they are marks, and
 * the only thing said out loud is the one the rules do state: over capacity,
 * you cannot carry it.
 */

import type { CarriedLoad } from "@/lib/carrying";
import { LABEL_MB2, WHISPER } from "@/styles/recipes";

const STATE_NOTE: Record<CarriedLoad["state"], string | null> = {
  clear: null,
  encumbered: "Con la variante de carga, esto es «cargado»: 10 pies menos de velocidad.",
  "heavily-encumbered":
    "Con la variante de carga, esto es «muy cargado»: 20 pies menos y desventaja en Fue, Des y Con.",
  "over-capacity": "Esto pasa tu capacidad de carga. No podes llevarlo.",
};

export default function CarryingLoad({ load, accent }: { load: CarriedLoad; accent: string }) {
  const { pounds, limits, state } = load;
  const filled = Math.min(pounds / Math.max(limits.capacity, 1), 1);
  const mark = (value: number) => Math.min(value / Math.max(limits.capacity, 1), 1) * 100;

  return (
    <div>
      <p className={LABEL_MB2}>Carga</p>

      <p className="mb-3 font-body text-sm text-bone/60">
        <span style={{ color: state === "over-capacity" ? "#ff5a1f" : accent }}>{pounds} lb</span>
        <span className="text-bone/35"> de {limits.capacity}</span>
        {/* Only claimed over what the index could weigh. */}
        {load.weighed < load.lines && (
          <span className="ml-2 font-mono text-[10px] tracking-[0.2em] text-bone/25">
            {load.weighed} de {load.lines} pesados
          </span>
        )}
      </p>

      <div className="relative h-2 w-full overflow-hidden border border-iron/40">
        <div
          className="h-full transition-all"
          style={{
            width: `${filled * 100}%`,
            background: state === "over-capacity" ? "#ff5a1f" : accent,
          }}
        />
        {/* The variant's two thresholds, marked and not enforced. */}
        {[limits.encumbered, limits.heavilyEncumbered].map((value) => (
          <span
            key={value}
            className="absolute top-0 h-full w-px bg-bone/30"
            style={{ left: `${mark(value)}%` }}
            aria-hidden
          />
        ))}
      </div>

      {STATE_NOTE[state] && (
        <p className={`mt-3 ${WHISPER}`} style={state === "over-capacity" ? { color: "#ff5a1f" } : undefined}>
          {STATE_NOTE[state]}
        </p>
      )}

      <p className={`mt-2 ${WHISPER}`}>
        Empujar, arrastrar o levantar: hasta {limits.pushDragLift} lb.
      </p>
    </div>
  );
}
