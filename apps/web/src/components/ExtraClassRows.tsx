import { useMemo } from "react";

import { optionsFor, type IndexOption } from "../index-options";
import type { BuilderClass } from "../builder";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

type Props = {
  classes: BuilderClass[];
  rulesVersion: RulesVersion;
  onChange: (next: BuilderClass[]) => void;
};

const LEVELS = Array.from({ length: 20 }, (_, index) => index + 1);

/**
 * The classes a character has beyond the first.
 *
 * The first class is not one of these. It is the class taken at level 1 and
 * the rules single it out — it alone grants saving throw proficiencies and
 * starting equipment, and its hit die is the one that arrives at maximum — so
 * it keeps its own place in the step above.
 *
 * Deliberately plain. Multiclassing has been unreachable through the builder
 * since the beginning while `classing.classes` sat there as an array, and the
 * shortest way to end that is a row with a class, a level and a subclass. What
 * it looks like is the design track's business.
 */
export function ExtraClassRows({ classes, rulesVersion, onChange }: Props) {
  const classOptions = useMemo(
    () => optionsFor({ prop: "class", rulesVersion, search: "", limit: 200 }),
    [rulesVersion],
  );

  const labelOf = (classId: string) =>
    classOptions.find((option) => option.id === classId)?.label ?? "";

  const update = (index: number, patch: Partial<BuilderClass>) => {
    onChange(classes.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)));
  };

  return (
    <div className="field">
      <label>Otras clases</label>

      {classes.map((entry, index) => (
        <ExtraClassRow
          entry={entry}
          key={index}
          onChange={(patch) => update(index, patch)}
          onRemove={() => onChange(classes.filter((_, at) => at !== index))}
          options={classOptions}
          parentName={labelOf(entry.classId)}
          rulesVersion={rulesVersion}
        />
      ))}

      <button
        className="btn"
        onClick={() => onChange([...classes, { classId: "", subclassId: "", level: 1 }])}
        type="button"
      >
        Agregar clase
      </button>
    </div>
  );
}

function ExtraClassRow({
  entry,
  options,
  parentName,
  rulesVersion,
  onChange,
  onRemove,
}: {
  entry: BuilderClass;
  options: IndexOption[];
  parentName: string;
  rulesVersion: RulesVersion;
  onChange: (patch: Partial<BuilderClass>) => void;
  onRemove: () => void;
}) {
  // Scoped to the class in this row, so a fighter row cannot be given a bard's
  // college. Empty until a class is chosen, which is why the select is
  // disabled rather than showing every subclass in the game.
  const subclassOptions = useMemo(
    () =>
      parentName ? optionsFor({ prop: "subclass", rulesVersion, search: "", limit: 200, parentName }) : [],
    [parentName, rulesVersion],
  );

  return (
    <div className="array-row">
      <select
        onChange={(event) => onChange({ classId: event.target.value, subclassId: "" })}
        value={entry.classId}
      >
        <option value="">Elegir clase&hellip;</option>
        {options.map((option) => (
          <option key={`${option.id}|${option.source}`} value={option.id}>
            {option.label}
            {option.shared ? ` (${option.source})` : ""}
          </option>
        ))}
      </select>

      <select
        onChange={(event) => onChange({ level: Number(event.target.value) })}
        value={entry.level}
      >
        {LEVELS.map((level) => (
          <option key={level} value={level}>
            Nivel {level}
          </option>
        ))}
      </select>

      <select
        disabled={subclassOptions.length === 0}
        onChange={(event) => onChange({ subclassId: event.target.value })}
        value={entry.subclassId}
      >
        <option value="">Sin subclase</option>
        {subclassOptions.map((option) => (
          <option key={`${option.id}|${option.source}`} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <button className="btn" onClick={onRemove} type="button">
        Quitar
      </button>
    </div>
  );
}
