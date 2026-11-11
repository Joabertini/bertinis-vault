import { useRef, useState } from "react";

import SigilMark from "@/components/codex/SigilMark";
import { CoverImageError, fitCoverImage } from "@/lib/cover-image";
import { sigilFor } from "@/lib/role-sigil";
import { LABEL } from "@/styles/recipes";

/**
 * Picks the picture for the character's book, and shows how the cover will
 * look: the picture, darkened toward the bottom, with the class's role sigil
 * in the middle. Without a picture the cover is the plain leather one.
 */
export default function CoverPicker({
  value,
  classId,
  name,
  onChange,
}: {
  value: string;
  classId: string;
  name: string;
  onChange: (next: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const sigil = sigilFor(classId);

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
      <p className={LABEL}>Tapa del libro</p>
      <div className="flex flex-wrap items-start gap-8">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void take(event.dataTransfer.files[0]);
          }}
          className={`relative h-60 w-40 shrink-0 overflow-hidden border bg-gradient-to-br from-[#2a2118] via-[#171310] to-black ${
            dragging ? "border-gold" : "border-iron"
          }`}
          aria-label="Vista previa de la tapa"
        >
          {value && <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" />
          <div className="absolute inset-x-0 top-[28%] flex justify-center">
            <SigilMark sigil={sigil} size={68} />
          </div>
          <p className="absolute inset-x-2 bottom-3 line-clamp-2 text-center font-display text-[13px] font-bold leading-tight tracking-wide text-bone">
            {name || "Sin nombre"}
          </p>
        </div>

        <div className="max-w-xs space-y-4">
          <p className="font-body text-[15px] leading-snug text-bone">
            La imagen que quieras para la tapa. Se recorta a la forma del libro y se achica para
            que entre en tu códice. El sigilo es el de tu rol ({sigil.name.toLowerCase()}).
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="border border-gold bg-[#17120A] px-6 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-[#241C0D] hover:text-gold disabled:opacity-50"
            >
              {busy ? "Preparando…" : value ? "Cambiar imagen" : "Subir imagen"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
              >
                Quitar
              </button>
            )}
          </div>
          <p className="font-body text-[13px] leading-snug text-bone/70">
            Sigilos: game-icons.net, de Lorc y Delapouite (CC BY 3.0).
          </p>
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
        aria-label="Subir imagen para la tapa"
        onChange={(event) => void take(event.target.files?.[0])}
      />
    </div>
  );
}
