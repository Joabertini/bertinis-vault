/**
 * One class's spells, when a character may have more than one class's worth.
 *
 * The chamber used to be a single block built from the first class. That is
 * what three of the beta reports were: a fighter who took wizard saw no Spells
 * chamber at all, and a wizard who took cleric saw the wizard list alone. The
 * rules ask the question once per class — spells known and prepared are settled
 * "as if you were a single-classed member of that class" — so the chamber
 * repeats this block once per class rather than merging the lists.
 *
 * The counts are the reason it has to be a repeat rather than a union: a wizard
 * 3 / cleric 3 prepares three of each, and one picker over both lists would let
 * them take six wizard spells and no cleric ones without ever saying no.
 */

import PickList from "./PickList";
import RuleNote from "@/components/ui/RuleNote";
import { formatSpellLine, type ClassSpellPlan } from "@/lib/spells";
import { LABEL, META } from "@/styles/recipes";

export default function SpellClassSection({
  plan,
  /** This class's share of the flat spell list; see `attributeSpells`. */
  cantrips,
  spells,
  book,
  characterLevel,
  accent,
  /** Off for a single-class character, where naming the class says nothing. */
  showName,
  onToggleCantrip,
  onToggleSpell,
  onToggleBookSpell,
}: {
  plan: ClassSpellPlan;
  cantrips: string[];
  spells: string[];
  book: string[];
  characterLevel: number;
  accent: string;
  showName: boolean;
  onToggleCantrip: (line: string) => void;
  onToggleSpell: (line: string) => void;
  onToggleBookSpell: (line: string) => void;
}) {
  const picker = plan.picker;
  if (!picker) return null;

  return (
    <div className="space-y-10">
      {showName && (
        <div className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-[0.06em]" style={{ color: accent }}>
            {plan.label.toUpperCase()}
          </span>
          <span className={`${META} text-bone`}>nivel {plan.classLevel}</span>
        </div>
      )}

      <p className="font-body text-bone">
        {picker.modeLabel}
        {picker.maxSpellLevel > 0
          ? ` · hasta nivel ${picker.maxSpellLevel}`
          : " · todavia sin espacios de conjuro"}
      </p>

      {picker.availableCantripCount > 0 && (
        <PickList
          title="Trucos"
          options={plan.cantripOptions}
          selected={cantrips}
          limit={picker.availableCantripCount}
          accent={accent}
          onToggle={onToggleCantrip}
        />
      )}

      {plan.book && (
        <div className="space-y-8 border-t border-iron/40 pt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={LABEL}>Libro de conjuros</span>
              <RuleNote title="El libro de conjuros">
                <p>Seis conjuros a nivel 1, y dos mas por cada nivel despues.</p>
                <p>
                  Lo que copies queda escrito aunque hoy no lo prepares: de aca salen los
                  preparados.
                </p>
              </RuleNote>
            </div>
            <span
              className={META}
              style={{ color: book.length >= plan.book.limit ? accent : "rgba(230,223,206,0.6)" }}
            >
              {book.length} / {plan.book.limit}
            </span>
          </div>

          {plan.book.options.map(({ level, names }) => (
            <PickList
              key={level}
              title={`Nivel ${level}`}
              options={names.map((name) => formatSpellLine(level, name))}
              selected={book}
              limit={plan.book!.limit}
              accent={accent}
              onToggle={onToggleBookSpell}
            />
          ))}
        </div>
      )}

      {picker.spellLimit > 0 ? (
        <div className="space-y-8 border-t border-iron/40 pt-8">
          <div className="flex items-baseline justify-between">
            <span className={LABEL}>{picker.sectionTitle}</span>
            <span
              className={META}
              style={{
                color: spells.length === picker.spellLimit ? accent : "rgba(230,223,206,0.6)",
              }}
            >
              {spells.length} / {picker.spellLimit}
            </span>
          </div>

          {plan.spellsByLevel.map(({ level, names }) => (
            <PickList
              key={level}
              title={levelTitle(
                level,
                names.filter((name) => spells.includes(formatSpellLine(level, name))).length,
                plan.slotsByLevel[level] ?? 0,
              )}
              options={names.map((name) => formatSpellLine(level, name))}
              selected={spells}
              limit={picker.spellLimit}
              accent={accent}
              onToggle={onToggleSpell}
            />
          ))}
        </div>
      ) : (
        <p className="border-t border-iron/40 pt-8 font-body text-bone">
          {plan.book
            ? "Sin nada escrito en el libro no hay de donde preparar."
            : `A nivel ${characterLevel} ${plan.label} no prepara conjuros todavia.`}
        </p>
      )}
    </div>
  );
}

/** "Nivel 2 · 1 elegido · 3 espacios": what was chosen in this level beside what the level is worth. */
function levelTitle(level: number, chosen: number, slots: number): string {
  const picked = `${chosen} ${chosen === 1 ? "elegido" : "elegidos"}`;
  return slots > 0
    ? `Nivel ${level} · ${picked} · ${slots} ${slots === 1 ? "espacio" : "espacios"}`
    : `Nivel ${level} · ${picked}`;
}
