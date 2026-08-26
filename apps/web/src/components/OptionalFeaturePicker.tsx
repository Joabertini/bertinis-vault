import type { OptionalFeaturePrerequisiteLike, OptionalFeatureSlot } from "@bertinis-vault/domain";

type Option = {
  id: string;
  label: string;
  source: string;
  featureType: string[];
  unmet: OptionalFeaturePrerequisiteLike[];
  text: string[];
};

type Props = {
  slots: OptionalFeatureSlot[];
  /** Every option in the pools these slots draw on, already scoped. */
  optionsFor: (featureTypes: string[]) => Option[];
  taken: string[];
  onToggle: (optionId: string) => void;
};

/** A prerequisite in one short phrase, so a row can say why it is closed. */
function describe(entry: OptionalFeaturePrerequisiteLike): string {
  switch (entry.kind) {
    case "level":
      return entry.className ? `${entry.className} nivel ${entry.level}` : `nivel ${entry.level}`;
    case "pact":
      return `Pacto: ${entry.pact}`;
    case "spell":
      return `conjuro: ${entry.spell.split("#")[0]}`;
    case "optionalfeature":
      return entry.name;
  }
}

/**
 * The choices a class makes the player answer as it levels.
 *
 * Fighting styles, invocations, metamagic, maneuvers, runes, arcane shots,
 * elemental disciplines, infusions and the pact boon are one mechanism wearing
 * nine names: a pool, and a count that grows with level. All of it was modelled
 * and none of it was ever asked for — the build carried a list nothing filled
 * and nothing checked.
 *
 * An option whose prerequisites are unmet is shown and disabled rather than
 * hidden: a player who cannot yet take Agonizing Blast is better served
 * knowing it exists and what it wants.
 */
export function OptionalFeaturePicker({ slots, optionsFor, taken, onToggle }: Props) {
  if (slots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const options = optionsFor(slot.featureType);
        if (options.length === 0) return null;

        return (
          <div className="field" key={`${slot.grantedBy.name}-${slot.name}`}>
            <label>
              {slot.name} ({slot.taken.length} / {slot.count})
            </label>
            <div className="feat-info">
              De <strong>{slot.grantedBy.name}</strong>.
              {slot.remaining > 0
                ? ` Faltan ${slot.remaining} por elegir.`
                : slot.remaining < 0
                  ? ` Hay ${-slot.remaining} de mas: el nivel bajo y las elecciones quedaron.`
                  : " Completo."}
            </div>
            <div className="options-grid">
              {options.map((option) => {
                const checked = taken.includes(option.id);
                // Over quota, a row that is not already taken is closed. The
                // taken ones stay clickable so a player can swap one out.
                const full = !checked && slot.remaining <= 0;
                const blocked = option.unmet.length > 0;

                return (
                  <label
                    className={`opt${checked ? " selected" : ""}`}
                    key={`${option.id}-${option.source}`}
                    title={option.text.join(" | ")}
                  >
                    <input
                      checked={checked}
                      disabled={full || (blocked && !checked)}
                      onChange={() => onToggle(option.id)}
                      type="checkbox"
                    />
                    {option.label}
                    <span className="opt-source">{option.source}</span>
                    {blocked ? <> &mdash; pide {option.unmet.map(describe).join(", ")}</> : null}
                    {option.text.length > 0 ? <> &mdash; {option.text.join("; ")}</> : null}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
