import { useMemo, useState } from "react";

import { optionsFor, type IndexOption, type OptionQuery } from "../index-options";

type Props = {
  label: string;
  prop: OptionQuery["prop"];
  rulesVersion: OptionQuery["rulesVersion"];
  weaponsOnly?: boolean;
  armorOnly?: boolean;
  parentName?: string;
  /** The slug currently chosen, if any. */
  selectedId: string;
  /** The book chosen for that slug, when the name alone is ambiguous. */
  selectedSource?: string;
  selectedLabel?: string;
  onPick: (option: IndexOption) => void;
  inputId: string;
};

/**
 * A search over one category of the index.
 *
 * The index carries 160 races and 1773 items legal for 2014, which is not a
 * list anyone scrolls. Results are capped and ranked by the package's own
 * search, and each row names its book: the same name in two books is two
 * different documents, and picking the wrong one imports the wrong thing.
 */
export function IndexPicker({
  label,
  prop,
  rulesVersion,
  weaponsOnly,
  armorOnly,
  parentName,
  selectedId,
  selectedSource,
  selectedLabel,
  onPick,
  inputId,
}: Props) {
  const [search, setSearch] = useState("");

  const options = useMemo(
    () => optionsFor({ prop, rulesVersion, search, weaponsOnly, armorOnly, parentName }),
    [prop, rulesVersion, search, weaponsOnly, armorOnly, parentName],
  );

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        autoComplete="off"
        id={inputId}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={selectedLabel ? `Elegido: ${selectedLabel}` : "Buscar..."}
        type="text"
        value={search}
      />
      <div className="options-grid index-results">
        {options.map((option) => {
          const chosen = option.id === selectedId && (!option.shared || option.source === selectedSource);
          return (
            <label
              className={`opt${chosen ? " selected" : ""}`}
              key={`${option.id}:${option.source}`}
            >
              <input
                checked={chosen}
                name={inputId}
                onChange={() => onPick(option)}
                type="radio"
              />
              {option.label} <span className="opt-source">{option.source}</span>
            </label>
          );
        })}
        {options.length === 0 && <div className="field-warning">Nada coincide con esa busqueda.</div>}
      </div>
    </div>
  );
}
