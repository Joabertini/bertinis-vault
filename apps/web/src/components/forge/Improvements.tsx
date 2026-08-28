/**
 * The choice every class makes at 4, 8, 12, 16 and 19.
 *
 * Two points spread across abilities, or a feat instead. The rules treat these
 * as one decision, so they are one control here rather than two lists that can
 * both be filled.
 *
 * A feat that carries its own increase asks a second question. Losing that +1
 * silently is the failure the repo's `feat-abilities` module exists to prevent
 * — the sheet used to show a Charisma one point low with nothing to explain it
 * — so an unplaced one is called out rather than defaulted.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { AbilityBonusMap } from "@bertinis-vault/domain";

import BonusEditor from "@/components/forge/BonusEditor";
import ScryPicker from "@/components/forge/ScryPicker";
import { ABILITY_IDS, abilityLabels, type AbilityId } from "@/lib/abilities";
import type { BuilderState } from "@/lib/builder";
import type { CatalogEntry } from "@/lib/catalog";
import { featAbilityGrantsFor, optionsFor } from "@/lib/index-options";
import {
  choiceAt,
  maxPointsPerAbility,
  pointsPerImprovement,
  scoresBefore,
  featPrerequisiteProblemsFor,
} from "@/lib/improvements";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";
import { DIVIDER_TIGHT, LABEL, LABEL_MB2, WHISPER } from "@/styles/recipes";

export default function Improvements({
  state,
  levels,
  rulesVersion,
  accent,
  onSetChoice,
  onSetFeatAbilities,
}: {
  state: BuilderState;
  levels: number[];
  rulesVersion: RulesVersion;
  accent: string;
  onSetChoice: (level: number, choice: BuilderState["levelChoices"][number]) => void;
  onSetFeatAbilities: (featId: string, bonuses: AbilityBonusMap) => void;
}) {
  const before = useMemo(() => scoresBefore(state), [state]);

  if (levels.length === 0) {
    return (
      <p className="font-body italic text-bone/35">
        A nivel {state.level} esta clase todavia no otorga mejoras de aptitud. La primera llega a
        nivel 4.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {levels.map((level) => (
        <LevelSlot
          key={level}
          level={level}
          state={state}
          before={before}
          rulesVersion={rulesVersion}
          accent={accent}
          onSetChoice={onSetChoice}
          onSetFeatAbilities={onSetFeatAbilities}
        />
      ))}
    </div>
  );
}

function LevelSlot({
  level,
  state,
  before,
  rulesVersion,
  accent,
  onSetChoice,
  onSetFeatAbilities,
}: {
  level: number;
  state: BuilderState;
  before: Record<AbilityId, number>;
  rulesVersion: RulesVersion;
  accent: string;
  onSetChoice: (level: number, choice: BuilderState["levelChoices"][number]) => void;
  onSetFeatAbilities: (featId: string, bonuses: AbilityBonusMap) => void;
}) {
  const choice = choiceAt(state, level);
  const isFeat = choice.kind === "feat";

  const featSearch = useMemo(
    () => (query: string) => optionsFor({ prop: "feat", rulesVersion, search: query, limit: 24 }),
    [rulesVersion],
  );

  const featId = isFeat ? choice.featId : "";

  return (
    <div className={DIVIDER_TIGHT}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <span className={LABEL}>
          Nivel {level}
        </span>

        <div className="flex border border-iron/60">
          <Tab
            active={!isFeat}
            accent={accent}
            onClick={() => onSetChoice(level, { kind: "improvement", bonuses: {} })}
          >
            Mejora
          </Tab>
          <Tab
            active={isFeat}
            accent={accent}
            onClick={() => onSetChoice(level, { kind: "feat", featId: "" })}
          >
            Dote
          </Tab>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={isFeat ? "feat" : "improvement"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {!isFeat ? (
            <BonusEditor
              bonuses={choice.bonuses}
              scoresBefore={before}
              budget={pointsPerImprovement}
              maxPerAbility={maxPointsPerAbility}
              accent={accent}
              onChange={(bonuses) => onSetChoice(level, { kind: "improvement", bonuses })}
            />
          ) : (
            <div className="max-w-xl space-y-6">
              <ScryPicker
                label={`Dote de nivel ${level}`}
                placeholder="Buscar dote…"
                search={featSearch}
                selectedId={featId}
                onPick={(entry: CatalogEntry) =>
                  onSetChoice(level, { kind: "feat", featId: entry.id })
                }
                accent={accent}
              />

              {featId && <FeatPrerequisiteNote state={state} featId={featId} />}

              {featId && (
                <FeatAbilityPlacement
                  featId={featId}
                  rulesVersion={rulesVersion}
                  chosen={state.featAbilityChoices[featId] ?? {}}
                  before={before}
                  accent={accent}
                  onChange={(bonuses) => onSetFeatAbilities(featId, bonuses)}
                />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * The increase a half-feat carries.
 *
 * A fixed grant is shown but not editable — Actor raises Charisma whether or
 * not the player agrees. A choice waits for an answer, and says so.
 */
function FeatAbilityPlacement({
  featId,
  rulesVersion,
  chosen,
  before,
  accent,
  onChange,
}: {
  featId: string;
  rulesVersion: RulesVersion;
  chosen: AbilityBonusMap;
  before: Record<AbilityId, number>;
  accent: string;
  onChange: (bonuses: AbilityBonusMap) => void;
}) {
  const grants = useMemo(
    () => featAbilityGrantsFor(featId, rulesVersion),
    [featId, rulesVersion],
  );

  if (grants.length === 0) return null;

  const fixed = grants.filter((grant) => grant.kind === "fixed");
  const choices = grants.filter((grant) => grant.kind === "choice");

  return (
    <div className="border-l-2 pl-4" style={{ borderLeftColor: `${accent}66` }}>
      {fixed.map((grant, index) => (
        <p key={`fixed-${index}`} className="font-body text-sm italic text-bone/45">
          Otorga{" "}
          {Object.entries(grant.bonuses)
            .map(([ability, amount]) => `+${amount} a ${abilityLabels[ability as AbilityId] ?? ability}`)
            .join(", ")}
          .
        </p>
      ))}

      {choices.map((grant, index) => {
        const options = grant.from.length > 0 ? grant.from : [...ABILITY_IDS];
        const placed = Object.keys(chosen).length;

        return (
          <div key={`choice-${index}`} className="mt-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ember/80">
              {placed >= grant.count
                ? "Aumento asignado"
                : `Falta asignar +${grant.amount} — elegi ${grant.count}`}
            </p>

            <div className="flex flex-wrap gap-2">
              {options.map((ability) => {
                const id = ability as AbilityId;
                const active = (chosen[id] ?? 0) > 0;
                const atCap = before[id] >= 20;

                return (
                  <button
                    key={ability}
                    disabled={!active && (placed >= grant.count || atCap)}
                    onClick={() => {
                      const next = { ...chosen };
                      if (active) delete next[id];
                      else next[id] = grant.amount;
                      onChange(next);
                    }}
                    className="border px-3 py-1.5 font-display text-xs font-bold tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-25"
                    style={{
                      borderColor: active ? accent : "rgba(74,70,64,0.6)",
                      color: active ? accent : "#E6DFCE",
                      background: active ? `${accent}12` : "transparent",
                    }}
                    title={atCap ? "Ya esta en el tope" : abilityLabels[id]}
                  >
                    {id.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tab({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2 font-mono text-[10px] uppercase tracking-[0.25em] transition-colors"
      style={{
        background: active ? `${accent}18` : "transparent",
        color: active ? accent : "rgba(230,223,206,0.4)",
      }}
    >
      {children}
    </button>
  );
}

/**
 * What the books ask of a feat this character has already picked.
 *
 * Said, never enforced. A table may allow anything, and 85% of the 2024 feats
 * ask for something — mostly a level — so a builder that refused would be a
 * builder people work around. The two halves read differently on purpose:
 * what the build can check is stated flatly, and what only a table can settle
 * is handed back to the player rather than dressed up as a failure.
 *
 * Nothing renders for a feat that asks nothing, which is most of the ones a
 * character actually reaches for.
 */
function FeatPrerequisiteNote({ state, featId }: { state: BuilderState; featId: string }) {
  const problems = useMemo(
    () => featPrerequisiteProblemsFor(state, featId),
    [state, featId],
  );
  if (!problems.length) return null;

  const unmet = problems.flatMap((problem) => (problem.kind === "unmet" ? problem.reasons : []));
  const unverifiable = problems.flatMap((problem) =>
    problem.kind === "unverifiable" ? problem.notes : [],
  );

  return (
    <div className={DIVIDER_TIGHT}>
      {unmet.length > 0 && (
        <>
          <p className={LABEL_MB2}>Le falta</p>
          <ul className="space-y-1">
            {unmet.map((reason) => (
              <li key={reason} className="font-body text-sm text-ember/80">
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}

      {unverifiable.length > 0 && (
        <ul className={unmet.length ? "mt-4 space-y-1" : "space-y-1"}>
          {unverifiable.map((note) => (
            <li key={note} className={WHISPER}>
              {note} — lo decide tu mesa.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
