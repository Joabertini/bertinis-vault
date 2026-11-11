/**
 * Searching the parts of the catalog too large to draw.
 *
 * The core book gets sigil cards. Everything else — 150 further species, 161
 * backgrounds, the subclasses — arrives through here: a lens, a query, and a
 * short ranked list. The book each result came from is always shown, because
 * for the names that exist in more than one book it is the only thing telling
 * them apart, and a build stores it.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { CatalogEntry } from "@/lib/catalog";
import { ITEM_META, ITEM_NAME } from "@/styles/recipes";

export default function ScryPicker({
  label,
  placeholder,
  search,
  selectedId,
  onPick,
  accent,
  emptyHint,
}: {
  label: string;
  placeholder: string;
  /** Runs the query against the index. Called on every keystroke. */
  search: (query: string) => CatalogEntry[];
  selectedId: string;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => search(query), [search, query]);

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

      <div className="mt-4 max-h-72 space-y-1 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {results.map((entry) => {
            const active = entry.id === selectedId;

            return (
              <motion.button
                key={`${entry.id}:${entry.source}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => onPick(entry)}
                className="flex w-full items-baseline justify-between gap-4 border-l-2 px-4 py-2.5 text-left transition-colors"
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
              </motion.button>
            );
          })}
        </AnimatePresence>

        {results.length === 0 && (
          <p className="py-8 text-center font-body text-bone">
            {query
              ? "Ningun nombre responde a tu adivinacion."
              : (emptyHint ?? "Escribi para buscar en los demas libros.")}
          </p>
        )}
      </div>
    </div>
  );
}
