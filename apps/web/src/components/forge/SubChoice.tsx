import { useInfo } from "@/components/info/info-context";
import type { CatalogEntry } from "@/lib/catalog";
import { DIVIDER_TIGHT, ITEM_META, ITEM_NAME, LABEL, WHISPER } from "@/styles/recipes";

/**
 * A sub-pick under something already chosen: a subrace, a subclass.
 *
 * Shown as a list rather than cards because the counts are unpredictable —
 * one class offers four sendas and the 2014 cleric offers nineteen — and a
 * grid that is sometimes two tiles and sometimes twenty reads as a mistake.
 */
export default function SubChoice({
  title,
  hint,
  options,
  selectedId,
  onPick,
  accent,
  note,
  infoClass,
}: {
  /** The class's name, which is what tells two same-named subclasses apart in the books. */
  infoClass?: string;
  title: string;
  hint: string;
  options: CatalogEntry[];
  selectedId: string;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  /** An honest caveat, when the pick does not yet travel the whole way. */
  note?: string;
}) {
  const info = useInfo();
  return (
    <div className={DIVIDER_TIGHT}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className={LABEL}>
          {title}
        </span>
        <span className={WHISPER}>{hint}</span>
      </div>

      <div className="mt-5 grid max-h-64 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {options.map((entry) => {
          const active = entry.id === selectedId;

          return (
            <button
              key={`${entry.id}:${entry.source}`}
              onClick={() => {
                onPick(entry);
                info.show({ kind: "subclass", name: entry.label, source: entry.source, extra: [infoClass ?? ""] });
              }}
              className="flex items-baseline justify-between gap-3 border-l-2 px-4 py-2.5 text-left transition-colors"
              style={{
                borderLeftColor: active ? accent : "transparent",
                background: active ? `${accent}12` : "transparent",
              }}
            >
              <span
                className={ITEM_NAME}
                style={{ color: active ? accent : "#FFFFFF" }}
              >
                {entry.label}
              </span>
              <span className={ITEM_META}>
                {entry.source}
              </span>
            </button>
          );
        })}
      </div>

      {note && (
        <p className="mt-4 border-l-2 border-ember/50 pl-3 font-body text-[15px] leading-relaxed text-bone">
          {note}
        </p>
      )}
    </div>
  );
}
