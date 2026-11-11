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

import { useInfo } from "@/components/info/info-context";
import type { CatalogEntry } from "@/lib/catalog";
import type { RulesKind } from "@/lib/rules-text";
import Sigil from "@/components/sigils/Sigil";
import SigilCard from "./SigilCard";

export default function SigilShelf({
  entries,
  selectedId,
  selectedSource,
  onPick,
  accent,
  placeholder,
  label,
  /** Drawn under a card's name. The book, usually. */
  noteFor,
  /**
   * Which heading an entry belongs under, when the shelf holds more than one
   * kind of thing.
   *
   * Tasha's sidekick classes sit in the class list beside the wizard and read
   * as ordinary classes, which they are not: they are the simplified companion
   * classes, and a player scrolling past Warrior has no way to tell. Returning
   * undefined leaves an entry in the main run, so a shelf that groups nothing
   * passes nothing and is unchanged.
   */
  groupFor,
  infoKind,
}: {
  entries: CatalogEntry[];
  selectedId: string;
  /**
   * The book the selected entry came from.
   *
   * An id is not unique on this shelf. The goblin is printed in six books and
   * every one of them is `goblin`, so matching on the id alone lit all six at
   * once and the player could not tell which one they had picked. The card key
   * below has always been `id:source` - the shelf knew the source was what told
   * them apart, and the selection check was the one place that did not ask.
   *
   * Optional, and when it is absent the id decides on its own. Shelves whose
   * entries are unique - the classes, the backgrounds - pass nothing and behave
   * exactly as they did.
   */
  selectedSource?: string | undefined;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  placeholder: string;
  label: string;
  noteFor?: (entry: CatalogEntry) => string | undefined;
  groupFor?: ((entry: CatalogEntry) => string | undefined) | undefined;
  /** What a card is, so the info panel can show it on hover and on choosing it. */
  infoKind?: RulesKind | undefined;
}) {
  const info = useInfo();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = normalizeForSearch(query).trim();
    if (!needle) return entries;
    return entries.filter((entry) => normalizeForSearch(entry.label).includes(needle));
  }, [entries, query]);

  const isSelected = (entry: CatalogEntry) =>
    entry.id === selectedId && (!selectedSource || entry.source === selectedSource);

  /*
   * Ungrouped entries stay first and keep their order; each heading follows in
   * the order it first appears. A shelf with no `groupFor` produces one
   * headingless run, which renders exactly as the flat grid always did.
   */
  const grouped = useMemo(() => {
    const runs: Array<{ heading: string | undefined; items: CatalogEntry[] }> = [];
    for (const entry of shown) {
      const heading = groupFor?.(entry);
      const run = runs.find((candidate) => candidate.heading === heading);
      if (run) run.items.push(entry);
      else runs.push({ heading, items: [entry] });
    }
    return runs.sort((left, right) => Number(Boolean(left.heading)) - Number(Boolean(right.heading)));
  }, [shown, groupFor]);

  const selected = entries.find(isSelected);
  const selectionHidden = Boolean(selected) && !shown.some(isSelected);

  return (
    <div>
      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="w-full border-b border-iron bg-transparent pb-2.5 pl-8 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
        />
        <svg
          className="absolute left-0 top-1 h-4 w-4 text-gold"
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
        <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
          {shown.length === entries.length
            ? `${entries.length} en total`
            : `${shown.length} de ${entries.length}`}
        </p>
        {selectionHidden && selected && (
          <p className="font-body text-[15px] text-bone">
            Elegido: <span style={{ color: accent }}>{selected.label}</span>
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 font-body text-[15px] text-bone">
          Nada con ese nombre en esta edicion.
        </p>
      ) : (
        // Nine compact cards tall. The scrollbar is the affordance that says
        // there is more below, so the container is deliberately not sized to
        // the content.
        <div className="mt-4 max-h-[27rem] overflow-y-auto pr-2">
          {grouped.map(({ heading, items }) => (
            <div key={heading ?? "main"} className={heading ? "mt-8" : ""}>
              {heading && (
                <p className="mb-3 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
                  {heading}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((entry) => {
                  const ref = infoKind ? { kind: infoKind, name: entry.label, source: entry.source } : null;
                  return (
                    <div
                      key={`${entry.id}:${entry.source}`}
                      className="contents"
                    >
                      <SigilCard
                        compact
                        label={entry.label}
                        note={noteFor?.(entry)}
                        active={isSelected(entry)}
                        accent={accent}
                        onClick={() => {
                          onPick(entry);
                          if (ref) info.show(ref);
                        }}
                      >
                        <Sigil name={entry.id} size={30} />
                      </SigilCard>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
