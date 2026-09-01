/**
 * A whole catalog as cards, searched in place.
 *
 * The Forge used to split its catalogs in two: the core book drawn as cards,
 * and the remaining hundred and fifty behind a separate search box labelled
 * "other books". That reads as a main list and an appendix, and a player who
 * does not already know which book their species is printed in cannot tell
 * which half to look in. One shelf instead — every option, core book first,
 * filtered by a field at the top.
 *
 * The viewport is sized to show nine cards and scroll past the rest, so the
 * shelf takes the same room whether it holds nine species or a hundred and
 * sixty.
 *
 * A filtered-out selection is still reported under the field. Otherwise
 * typing a query appears to clear the choice, and the player re-picks
 * something they had already chosen.
 */

import { useMemo, useState } from "react";

import { normalizeForSearch } from "@bertinis-vault/vetools-index";

import type { CatalogEntry } from "@/lib/catalog";
import Sigil from "@/components/sigils/Sigil";
import SigilCard from "./SigilCard";

export default function SigilShelf({
  entries,
  selectedId,
  onPick,
  accent,
  placeholder,
  label,
  /** Drawn under a card's name. The book, usually. */
  noteFor,
}: {
  entries: CatalogEntry[];
  selectedId: string;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  placeholder: string;
  label: string;
  noteFor?: (entry: CatalogEntry) => string | undefined;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = normalizeForSearch(query).trim();
    if (!needle) return entries;
    return entries.filter((entry) => normalizeForSearch(entry.label).includes(needle));
  }, [entries, query]);

  const selected = entries.find((entry) => entry.id === selectedId);
  const selectionHidden = Boolean(selected) && !shown.some((entry) => entry.id === selectedId);

  return (
    <div>
      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="w-full border-b border-iron bg-transparent pb-2.5 pl-8 font-body text-base text-bone outline-none transition-colors placeholder:text-bone/45 focus:border-gold"
        />
        <svg
          className="absolute left-0 top-1 h-4 w-4 text-gold/85"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="10" cy="10" r="6" />
          <path d="M15 15l6 6" />
        </svg>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/60">
          {shown.length === entries.length
            ? `${entries.length} en total`
            : `${shown.length} de ${entries.length}`}
        </p>
        {selectionHidden && selected && (
          <p className="font-body text-[13px] text-bone/60">
            Elegido: <span style={{ color: accent }}>{selected.label}</span>
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 font-body text-sm text-bone/60">
          Nada con ese nombre en esta edicion.
        </p>
      ) : (
        // Nine compact cards tall. The scrollbar is the affordance that says
        // there is more below, so the container is deliberately not sized to
        // the content.
        <div className="mt-4 max-h-[27rem] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((entry) => (
              <SigilCard
                key={`${entry.id}:${entry.source}`}
                compact
                label={entry.label}
                note={noteFor?.(entry)}
                active={selectedId === entry.id}
                accent={accent}
                onClick={() => onPick(entry)}
              >
                <Sigil name={entry.id} size={30} />
              </SigilCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
