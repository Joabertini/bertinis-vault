import {
  describeOriginAbilityOption,
  type OriginAbilityAnswer,
  type OriginAbilityOption,
} from "@bertinis-vault/domain";

type Props = {
  /** Null in 2014, where the increase belongs to the species. */
  alternatives: OriginAbilityOption[] | null;
  answer: OriginAbilityAnswer | null;
  pending: number;
  onChange: (answer: OriginAbilityAnswer) => void;
};

const ABILITY_LABELS: Record<string, string> = {
  str: "Fuerza",
  dex: "Destreza",
  con: "Constitucion",
  int: "Inteligencia",
  wis: "Sabiduria",
  cha: "Carisma",
};

/**
 * The ability increase a 2024 background grants.
 *
 * Renders nothing in 2014, where the species carries the increase and this is
 * not a question anyone is asked. In 2024 it is the whole of a character's
 * level-one increase: the ten 2024 species grant none, so a character who
 * never answers this is three points short of what the rules give them.
 */
export function OriginAbilityPicker({ alternatives, answer, pending, onChange }: Props) {
  if (!alternatives?.length) return null;

  const optionIndex = answer?.optionIndex ?? 0;
  const alternative = alternatives[optionIndex] ?? alternatives[0];
  if (!alternative) return null;

  const picked = answer ?? { optionIndex, abilities: [] };

  const setSlot = (slot: number, ability: string) => {
    const abilities = [...picked.abilities];
    if (ability) abilities[slot] = ability;
    else abilities.splice(slot, 1);
    onChange({ optionIndex, abilities });
  };

  return (
    <div className="field">
      <label>Aumento de atributo del trasfondo (2024)</label>

      <select
        id="origin-ability-option"
        onChange={(event) => onChange({ optionIndex: Number(event.target.value), abilities: [] })}
        value={optionIndex}
      >
        {alternatives.map((option, index) => (
          <option key={describeOriginAbilityOption(option)} value={index}>
            {describeOriginAbilityOption(option)}
          </option>
        ))}
      </select>

      <div className="array-row">
        {alternative.amounts.map((amount, slot) => {
          // The same ability cannot take both halves: +2 and +1 to Wisdom is
          // +3 to one score, which no background grants.
          const taken = new Set(picked.abilities.filter((_, index) => index !== slot));
          const options = alternative.options.filter(
            (ability) => !taken.has(ability) || picked.abilities[slot] === ability,
          );

          return (
            <select
              id={`origin-ability-${slot}`}
              key={slot}
              onChange={(event) => setSlot(slot, event.target.value)}
              value={picked.abilities[slot] ?? ""}
            >
              <option value="">+{amount} a&hellip;</option>
              {options.map((ability) => (
                <option key={ability} value={ability}>
                  +{amount} {ABILITY_LABELS[ability] ?? ability}
                </option>
              ))}
            </select>
          );
        })}
      </div>

      {pending > 0 ? (
        <div className="feat-info">
          Faltan <strong>{pending}</strong>. En 2024 la especie no da atributos: todo el aumento
          inicial sale de aca, asi que sin responder el personaje queda tres puntos corto.
        </div>
      ) : null}
    </div>
  );
}
