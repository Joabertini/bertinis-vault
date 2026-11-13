import { useRef, useState } from "react";

import { CoverImageError, fitCoverImage } from "@/lib/cover-image";
import { LABEL } from "@/styles/recipes";

/**
 * The token, apart from the portrait. Foundry keeps two pictures per actor:
 * the portrait (`img`) and the prototype token's texture. Without one here the
 * portrait is used for both, as before. Stored as uploaded, like the portrait.
 */
export default function TokenPicker({
  value,
  portrait,
  onChange,
}: {
  value: string;
  portrait: string;
  onChange: (next: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const shown = value || portrait;

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem("");
    try {
      onChange(await fitCoverImage(file));
    } catch (error) {
      setProblem(error instanceof CoverImageError ? error.message : "No pude usar esa imagen.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <p className={LABEL}>Token</p>
      <div className="flex flex-wrap items-center gap-8">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void take(event.dataTransfer.files[0]);
          }}
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-iron bg-[#171310]"
          aria-label="Vista previa del token"
        >
          {shown && <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        </div>
        <div className="max-w-xs space-y-4">
          <p className="font-body text-[15px] leading-snug text-bone">
            {value
              ? "El token que se ve en el mapa de Foundry, aparte del retrato."
              : "Sin token propio, Foundry usa el retrato. Subí uno si querés otro en el mapa."}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="border border-gold bg-[#17120A] px-6 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-[#241C0D] hover:text-gold disabled:opacity-50"
            >
              {busy ? "Subiendo…" : value ? "Cambiar token" : "Subir token"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
              >
                Usar el retrato
              </button>
            )}
          </div>
          {problem && (
            <p role="alert" className="font-body text-[15px] text-[#FF7043]">
              {problem}
            </p>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Subir imagen para el token"
        onChange={(event) => void take(event.target.files?.[0])}
      />
    </div>
  );
}
