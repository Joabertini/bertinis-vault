/**
 * The rest of what a character carries.
 *
 * Weapon and armour are single picks with mechanical weight — one is what you
 * swing, one sets your armour class. Everything else is a bag: a spellbook, a
 * component pouch, rope, rations. So this is additive rather than exclusive,
 * and what is already in the bag is shown as chips that can be dropped.
 *
 * It matters more than flavour for some classes: a wizard without a spellbook
 * imports without the thing their whole class runs on.
 */

import type { GearLine } from "@/lib/gear-lines";
import { collapseGearLines } from "@/lib/gear-lines";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

import ScryPicker from "@/components/forge/ScryPicker";
import type { CatalogEntry } from "@/lib/catalog";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";
import { RARITY_LABEL, RARITY_TINT, factsFor, nameFor } from "@/lib/item-facts";

/**
 * The tiers the list can be narrowed to, in the order a table reads them.
 *
 * `none` is the gear a character buys — rope, a tent, caltrops — and is on by
 * default: it is what a bag is mostly made of, and a list that opened on 1,700
 * magic items buried it.
 */
const RARITY_CHIPS: Array<{ key: string; label: string }> = [
  { key: "none", label: "Mundano" },
  { key: "common", label: "Comun" },
  { key: "uncommon", label: "Poco comun" },
  { key: "rare", label: "Raro" },
  { key: "very rare", label: "Muy raro" },
  { key: "legendary", label: "Legendario" },
  { key: "artifact", label: "Artefacto" },
];

export default function GearBag({
  carried,
  search,
  rulesVersion,
  accent,
  onAdd,
  onRemove,
}: {
  /** Item ids already in the bag. */
  carried: string[];
  /** Runs the query against the index, narrowed to the rarities ticked. */
  search: (query: string, rarities: readonly string[]) => CatalogEntry[];
  rulesVersion: RulesVersion;
  accent: string;
  onAdd: (entry: CatalogEntry) => void;
  onRemove: (id: string) => void;
}) {
  /*
   * What the bag weighs, for the rows the index knows.
   *
   * Counted rather than summed blindly: a bag can hold hand-typed lines that
   * are notes rather than objects, and a total that silently skipped them
   * while claiming to be the total would be worse than no total at all.
   */
  const [rarities, setRarities] = useState<string[]>(["none"]);
  const toggleRarity = (key: string) =>
    setRarities((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  const searchHere = useMemo(
    () => (query: string) => search(query, rarities),
    [search, rarities],
  );

  const bag = collapseGearLines(carried);
  const known = bag
    .map((entry) => ({ entry, facts: factsFor(entry.id, rulesVersion) }))
    .filter((pair): pair is { entry: GearLine; facts: NonNullable<typeof pair.facts> } =>
      pair.facts !== null,
    );

  // Twenty arrows weigh twenty arrows.
  const pounds = known.reduce(
    (total, { entry, facts }) => total + (facts.row.weight ?? 0) * entry.quantity,
    0,
  );

  // The count the player is carrying, not the number of lines they typed.
  const objects = bag.reduce((total, entry) => total + entry.quantity, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por rareza">
        {RARITY_CHIPS.map(({ key, label }) => {
          const on = rarities.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleRarity(key)}
              aria-pressed={on}
              className="border px-3 py-1 font-mono text-[13px] uppercase tracking-[0.1em] transition-colors hover:text-bone"
              style={{
                borderColor: on ? accent : `${accent}33`,
                color: on ? accent : "rgba(230,223,206,0.6)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ScryPicker
        label="Buscar equipo"
        placeholder="Buscar por nombre, o recorre la lista…"
        search={searchHere}
        // Nothing is "selected" in a bag — picking adds rather than replaces.
        selectedId=""
        onPick={onAdd}
        accent={accent}
        emptyHint="Ningun objeto con esas rarezas. Suma otra arriba."
      />

      {bag.length > 0 && (
        <div className="mt-6 border-t border-iron/40 pt-5">
          <p className="mb-3 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
            En la mochila — {objects}
            {/* Only claimed over what the index could weigh. */}
            {pounds > 0 && (
              <span className="ml-3 normal-case tracking-normal text-bone">
                {pounds} lb
                {known.length < bag.length && ` de ${known.length} de ${bag.length}`}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {bag.map(({ id, quantity }) => {
                const facts = factsFor(id, rulesVersion);

                return (
                  <motion.button
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    onClick={() => onRemove(id)}
                    className="group flex items-center gap-2 border px-3 py-1.5 transition-colors"
                    // Magic items wear their rarity as their border; everything
                    // else keeps the class tint, so the rare thing in a bag of
                    // rope and rations is the one that stands out.
                    style={{
                      borderColor: facts?.magic ? `${RARITY_TINT[facts.rarity]}88` : `${accent}55`,
                    }}
                    title={
                      facts?.magic
                        ? `${RARITY_LABEL[facts.rarity]} · sacar de la mochila`
                        : "Sacar de la mochila"
                    }
                  >
                    <span
                      className="font-body text-[15px]"
                      style={{ color: facts?.magic ? RARITY_TINT[facts.rarity] : accent }}
                    >
                      {nameFor(id, rulesVersion)}
                    </span>
                    {quantity > 1 && (
                      <span className="font-mono text-[13px] text-bone">×{quantity}</span>
                    )}
                    {facts?.attunement && (
                      <span className="font-mono text-[13px] text-ember" title="Requiere sintonizacion">
                        ◈
                      </span>
                    )}
                    <span className="font-mono text-[13px] text-bone transition-colors group-hover:text-ember">
                      ✕
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
