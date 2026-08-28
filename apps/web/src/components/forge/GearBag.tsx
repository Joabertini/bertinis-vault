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

import ScryPicker from "@/components/forge/ScryPicker";
import type { CatalogEntry } from "@/lib/catalog";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";
import { RARITY_LABEL, RARITY_TINT, factsFor, nameFor } from "@/lib/item-facts";

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
  search: (query: string) => CatalogEntry[];
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
      <ScryPicker
        label="Buscar equipo"
        placeholder="Libro de conjuros, cuerda, raciones…"
        search={search}
        // Nothing is "selected" in a bag — picking adds rather than replaces.
        selectedId=""
        onPick={onAdd}
        accent={accent}
        emptyHint="Escribi para buscar objetos."
      />

      {bag.length > 0 && (
        <div className="mt-6 border-t border-iron/40 pt-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-bone/40">
            En la mochila — {objects}
            {/* Only claimed over what the index could weigh. */}
            {pounds > 0 && (
              <span className="ml-3 normal-case tracking-normal text-bone/25">
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
                      className="font-body text-sm"
                      style={{ color: facts?.magic ? RARITY_TINT[facts.rarity] : accent }}
                    >
                      {nameFor(id, rulesVersion)}
                    </span>
                    {quantity > 1 && (
                      <span className="font-mono text-[10px] text-bone/40">×{quantity}</span>
                    )}
                    {facts?.attunement && (
                      <span className="font-mono text-[9px] text-ember/60" title="Requiere sintonizacion">
                        ◈
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-bone/25 transition-colors group-hover:text-ember">
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
