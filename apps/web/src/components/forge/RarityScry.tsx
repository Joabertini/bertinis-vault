/**
 * A search over items that opens on the mundane ones and can be widened by rarity.
 *
 * The weapon, armour and bag pickers all draw on the same 1,700 items, most of
 * them magic. Opened unfiltered they led with "+1 Moon Sickle" and "Animated
 * Shield" for a character who had not yet chosen a sword. So each starts on
 * what a character buys, and the tiers above are one tap away.
 */

import { useMemo, useState } from "react";

import ScryPicker from "@/components/forge/ScryPicker";
import type { CatalogEntry } from "@/lib/catalog";

/** The tiers a list can be narrowed to, in the order a table reads them. `none` is bought gear. */
export const RARITY_CHIPS: Array<{ key: string; label: string }> = [
  { key: "none", label: "Mundano" },
  { key: "common", label: "Comun" },
  { key: "uncommon", label: "Poco comun" },
  { key: "rare", label: "Raro" },
  { key: "very rare", label: "Muy raro" },
  { key: "legendary", label: "Legendario" },
  { key: "artifact", label: "Artefacto" },
];

export default function RarityScry({
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
  /** Runs the query, narrowed to the rarities ticked. */
  search: (query: string, rarities: readonly string[]) => CatalogEntry[];
  selectedId: string;
  onPick: (entry: CatalogEntry) => void;
  accent: string;
  emptyHint?: string;
}) {
  const [rarities, setRarities] = useState<string[]>(["none"]);
  const toggle = (key: string) =>
    setRarities((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  const searchHere = useMemo(() => (query: string) => search(query, rarities), [search, rarities]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por rareza">
        {RARITY_CHIPS.map(({ key, label: text }) => {
          const on = rarities.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className="border px-3 py-1 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors hover:text-bone"
              style={{
                borderColor: on ? accent : `${accent}33`,
                color: on ? accent : "rgba(230,223,206,0.6)",
              }}
            >
              {text}
            </button>
          );
        })}
      </div>

      <ScryPicker
        label={label}
        placeholder={placeholder}
        search={searchHere}
        selectedId={selectedId}
        onPick={onPick}
        accent={accent}
        {...(emptyHint ? { emptyHint } : {})}
      />
    </div>
  );
}
