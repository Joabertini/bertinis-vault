import { useRef, useState } from "react";

import { BANNER_HEIGHT, BANNER_WIDTH, bannerFor } from "@/lib/class-banner";
import { CoverImageError, fitCoverImage } from "@/lib/cover-image";
import { LABEL } from "@/styles/recipes";

/**
 * The banner across the top of the sheet.
 *
 * Without one of their own, a character shows their class's: its colour and its
 * sigil engraved. An uploaded banner is stored whole, like the portrait, and is
 * also the one Nerissa's `/showpj` card is to print.
 */
export default function BannerPicker({
  value,
  classId,
  onChange,
}: {
  value: string;
  classId: string;
  onChange: (next: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

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
      <p className={LABEL}>Banner</p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void take(event.dataTransfer.files[0]);
        }}
        className="relative w-full overflow-hidden border border-iron bg-[#171310]"
        style={{ aspectRatio: `${BANNER_WIDTH} / ${BANNER_HEIGHT}` }}
        aria-label="Vista previa del banner"
      >
        <img src={bannerFor({ bannerImage: value, classId })} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <p className="font-body text-[15px] leading-snug text-bone">
        {value
          ? "Tu banner: va arriba de la hoja y en la carta de /showpj."
          : `El de tu clase. Subí uno propio (ideal ${BANNER_WIDTH}×${BANNER_HEIGHT}; otra medida se recorta al centro).`}
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="border border-gold bg-[#17120A] px-6 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-[#241C0D] hover:text-gold disabled:opacity-50"
        >
          {busy ? "Subiendo…" : value ? "Cambiar banner" : "Subir banner"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
          >
            Usar el de la clase
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="font-body text-[15px] text-[#FF7043]">
          {problem}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Subir imagen para el banner"
        onChange={(event) => void take(event.target.files?.[0])}
      />
    </div>
  );
}
