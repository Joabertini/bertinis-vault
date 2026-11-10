/**
 * The classes past the first.
 *
 * Kept quiet on purpose. Most characters have one class, and a player making
 * their first one should not have to walk past a multiclass panel to get to
 * the next chamber. So it opens from a single line, and once open it says out
 * loud the thing the books say and every builder forgets: a second class is
 * not a first one.
 */

import { motion, AnimatePresence } from "framer-motion";

import type { CatalogEntry } from "@/lib/catalog";
import { subclassesFor } from "@/lib/catalog";
import type { ExtraClass } from "@/lib/classing";
import { levellingFor } from "@/lib/index-options";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";
import RuleNote from "@/components/ui/RuleNote";
import { DIVIDER, LABEL, LABEL_MB2, WHISPER } from "@/styles/recipes";

/** A class the character has levels in but does not qualify for. */
export type RequirementProblem = {
  classId: string;
  requirements: Record<string, number>[];
};

const ABILITY_LABEL: Record<string, string> = {
  str: "Fuerza",
  dex: "Destreza",
  con: "Constitucion",
  int: "Inteligencia",
  wis: "Sabiduria",
  cha: "Carisma",
};

/** "Fuerza 13 o Destreza 13" — the alternatives, as the book states them. */
function requirementLine(requirements: Record<string, number>[]): string {
  return requirements
    .map((option) =>
      Object.entries(option)
        .map(([ability, minimum]) => `${ABILITY_LABEL[ability] ?? ability} ${minimum}`)
        .join(" y "),
    )
    .join(" o ");
}

export default function Multiclass({
  extras,
  classes,
  primaryClassId,
  primaryLevel,
  rulesVersion,
  accent,
  problems,
  onChange,
  onRemove,
  onAdd,
}: {
  extras: ExtraClass[];
  classes: CatalogEntry[];
  primaryClassId: string;
  primaryLevel: number;
  rulesVersion: RulesVersion;
  accent: string;
  problems: RequirementProblem[];
  onChange: (index: number, next: ExtraClass) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const spent = extras.reduce((total, extra) => total + extra.level, primaryLevel);
  const roomLeft = 20 - spent;

  return (
    <div className={DIVIDER}>
      <div className="mb-6 flex items-center gap-3">
        <p className={LABEL}>Multiclase</p>
        <RuleNote title="Multiclase">
          <p>
            Una clase que sumas no te da su equipo inicial ni sus salvaciones — solo la tabla de
            competencias de multiclase.
          </p>
        </RuleNote>
      </div>

      <AnimatePresence mode="popLayout">
        {extras.map((extra, index) => {
          const taken = classes.find((entry) => entry.id === extra.classId);
          const problem = problems.find((entry) => entry.classId === extra.classId);
          const subclassLevel = extra.classId
            ? (levellingFor(extra.classId, rulesVersion).subclassLevel ?? 3)
            : 3;
          const subclasses =
            taken && extra.level >= subclassLevel ? subclassesFor(taken.label, rulesVersion) : [];

          return (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 border border-iron/40 p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <select
                  value={extra.classId}
                  onChange={(event) =>
                    // Changing the class drops the subclass with it: a School
                    // of Evocation is not a thing a barbarian can be.
                    onChange(index, { ...extra, classId: event.target.value, subclassId: "" })
                  }
                  className="flex-1 border border-iron/50 bg-void px-3 py-2 font-body text-sm text-bone"
                  aria-label="Clase"
                >
                  <option value="">Elegi una clase…</option>
                  {classes
                    // A class is taken once: the first class, and every other
                    // row's, are not offered again. Two fighter rows are one
                    // fighter with the levels split, and nothing downstream
                    // reads them that way.
                    .filter(
                      (entry) =>
                        entry.id === extra.classId ||
                        (entry.id !== primaryClassId &&
                          !extras.some((other, at) => at !== index && other.classId === entry.id)),
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/60 transition-colors hover:text-ember"
                >
                  Sacar
                </button>
              </div>

              {extra.classId && (
                <>
                  <label className={`mb-3 block ${LABEL}`}>
                    Niveles — <span style={{ color: accent }}>{extra.level}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    // Twenty levels, shared. What this class can reach is what
                    // the others have not taken.
                    max={Math.max(1, extra.level + roomLeft)}
                    value={extra.level}
                    onChange={(event) => {
                      const level = Number(event.target.value);
                      // Below the level that grants it, the subclass is not
                      // one the character has — and the list that would show
                      // it is gone, so it could not be seen to be cleared.
                      onChange(index, {
                        ...extra,
                        level,
                        subclassId: level >= subclassLevel ? extra.subclassId : "",
                      });
                    }}
                    className="w-full accent-gold"
                    aria-label={`Niveles de ${taken?.label ?? "la clase"}`}
                  />
                </>
              )}

              {subclasses.length > 0 && (
                <div className="mt-5">
                  <p className={LABEL_MB2}>Senda</p>
                  <select
                    value={extra.subclassId}
                    onChange={(event) =>
                      onChange(index, { ...extra, subclassId: event.target.value })
                    }
                    className="w-full border border-iron/50 bg-void px-3 py-2 font-body text-sm text-bone"
                    aria-label="Senda"
                  >
                    <option value="">Sin elegir</option>
                    {subclasses.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reported, never refused: a table that ignores this rule is a
                  table that exists, and a warning the player can read beats a
                  build they cannot make. */}
              {problem && (
                <p className="mt-4 font-body text-[13px] text-ember">
                  {taken?.label ?? extra.classId} pide {requirementLine(problem.requirements)}.
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <button
        type="button"
        onClick={onAdd}
        disabled={roomLeft < 1}
        className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60 transition-colors hover:text-gold disabled:cursor-not-allowed disabled:text-bone/45"
      >
        {roomLeft < 1 ? "Nivel 20 — no queda nivel para repartir" : "+ Sumar una clase"}
      </button>
    </div>
  );
}
