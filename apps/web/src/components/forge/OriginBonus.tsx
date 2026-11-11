/**
 * The species increase, as the books print it or as Tasha's moves it.
 *
 * Off, this is a statement: the dwarf gets +2 Constitution and there is nothing
 * to decide. On, it is a set of blocks and one ability each — never a pot of
 * points, because a +2 that can be split into two +1s is not the rule.
 *
 * The switch is offered rather than assumed. Customizing Your Origin is an
 * optional rule and plenty of tables do not use it; a player at one of those
 * opens this chamber wanting to see the book's spread and nothing else.
 */

import { motion } from "framer-motion";

import { ABILITY_IDS, abilityLabels, type AbilityId } from "@/lib/abilities";
import {
  assignmentComplete,
  assignmentFrom,
  bonusesFromAssignment,
  originBlocksFor,
  placeBlock,
} from "@/lib/origin";
import type { AbilityBonusMap } from "@bertinis-vault/domain";
import { META } from "@/styles/recipes";

export default function OriginBonus({
  printed,
  bonuses,
  custom,
  accent,
  onToggleCustom,
  onChange,
}: {
  /** What the species grants, where the book puts it. */
  printed: AbilityBonusMap;
  /** Where the player has put it. */
  bonuses: AbilityBonusMap;
  custom: boolean;
  accent: string;
  onToggleCustom: (next: boolean) => void;
  onChange: (next: AbilityBonusMap) => void;
}) {
  const blocks = originBlocksFor(printed);
  if (blocks.length === 0) return null;

  const assignment = assignmentFrom(custom ? bonuses : printed, blocks);
  const complete = assignmentComplete(assignment);

  const place = (index: number, ability: AbilityId) => {
    onChange(bonusesFromAssignment(blocks, placeBlock(assignment, index, ability)));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
          Aumento de especie
        </span>
        {custom && (
          <span className={META} style={{ color: complete ? accent : "rgba(230,223,206,0.6)" }}>
            {assignment.filter(Boolean).length} / {blocks.length} bloques
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggleCustom(!custom)}
        className="mb-5 flex items-start gap-3 text-left"
      >
        <span
          className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[13px]"
          style={{
            borderColor: custom ? accent : "#5A5A5A",
            background: custom ? accent : "transparent",
            color: "#0B0B0B",
          }}
        >
          {custom ? "✓" : ""}
        </span>
        <span className="font-body text-sm leading-relaxed text-bone">
          Personalizacion de Origen{" "}
          <span className="text-bone">
            (Tasha). Regla opcional: podes mover cada bloque entero a la caracteristica que
            quieras, pero no juntar dos en la misma. Preguntale a tu DM si la usan.
          </span>
        </span>
      </button>

      {!custom ? (
        <div className="flex flex-wrap gap-2">
          {ABILITY_IDS.flatMap((ability) => {
            const amount = printed[ability] ?? 0;
            return amount > 0 ? (
              <span
                key={ability}
                className="border px-3 py-1.5 font-body text-[15px]"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {abilityLabels[ability]} +{amount}
              </span>
            ) : (
              []
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={`${block}-${index}`}>
              <p className="mb-1.5 font-mono text-[13px] uppercase tracking-wide text-bone">
                Bloque de +{block}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ABILITY_IDS.map((ability) => {
                  const mine = assignment[index] === ability;
                  // Held by another block. Still clickable: the click means
                  // "swap", which is what a player reaching for a taken slot
                  // intends and is the only legal reading of it.
                  const elsewhere = !mine && assignment.includes(ability);

                  return (
                    <motion.button
                      key={ability}
                      onClick={() => place(index, ability)}
                      whileTap={{ scale: 0.97 }}
                      className="border px-2.5 py-1.5 font-mono text-[13px] uppercase tracking-wider transition-colors"
                      style={{
                        borderColor: mine ? accent : elsewhere ? "#5A5A5A" : "#3A3630",
                        background: mine ? `${accent}18` : "transparent",
                        color: mine ? accent : elsewhere ? "rgba(230,223,206,0.45)" : "#FFFFFF",
                      }}
                      title={elsewhere ? "Ocupada por otro bloque — cambiarlos de lugar" : undefined}
                    >
                      {abilityLabels[ability]}
                    </motion.button>
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
