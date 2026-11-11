import PickList from "@/components/forge/PickList";
import SubChoice from "@/components/forge/SubChoice";
import { abilityLabels, type AbilityId } from "@/lib/abilities";
import { abilityOptionsOf, type GrantedSpellChoice, type SpellGrantSource } from "@/lib/granted-spells";

/**
 * The named alternatives something offers, one question each.
 *
 * Six subclasses ask this — Circle of the Land's terrain, the Genie's four
 * patrons — and in 2024 two species do, which is not a spell question at all:
 * XPHB has no subraces, so an elf's Drow, High Elf and Wood Elf live only as
 * the names on its spell blocks. Until it is answered the character has none
 * of them, which is the honest reading: three lineages at once is three
 * characters.
 */
export default function VariantChoices({
  sources,
  chosen,
  chosenAbilities,
  questions,
  answers,
  accent,
  onPick,
  onPickAbility,
  onToggleSpell,
}: {
  sources: SpellGrantSource[];
  chosen: Record<string, string>;
  chosenAbilities: Record<string, string>;
  questions: GrantedSpellChoice[];
  answers: Record<string, string[]>;
  accent: string;
  onPick: (key: string, name: string) => void;
  onPickAbility: (key: string, ability: string) => void;
  onToggleSpell: (key: string, name: string) => void;
}) {
  const chambers = new Set(sources.map((source) => source.chamber));
  const asking = sources.filter((source) => source.variants.length > 0);
  const asary = sources.filter((source) => abilityOptionsOf(source).length > 0);
  const asked = questions.filter((question) => chambers.has(question.chamber));
  if (!asking.length && !asary.length && !asked.length) return null;

  return (
    <>
      {asking.map((source) => (
        <SubChoice
          key={source.key}
          title="Linaje"
          hint={`${source.label} se divide en ${source.variants.length}. Decide que conjuros trae.`}
          options={source.variants.map((name) => ({
            id: name,
            label: name,
            source: "",
            shared: false,
          }))}
          selectedId={chosen[source.key] ?? ""}
          onPick={(entry) => onPick(source.key, entry.id)}
          accent={accent}
        />
      ))}

      {asary.map((source) => (
        <SubChoice
          key={`${source.key}:ability`}
          title="Con que lanza esos conjuros"
          hint={`${source.label} deja elegir. Decide la CD de salvacion y el bonificador de ataque.`}
          options={abilityOptionsOf(source).map((ability) => ({
            id: ability,
            label: abilityLabels[ability as AbilityId] ?? ability,
            source: "",
            shared: false,
          }))}
          selectedId={chosenAbilities[source.key] ?? ""}
          onPick={(entry) => onPickAbility(source.key, entry.id)}
          accent={accent}
        />
      ))}

      {asked.map((question) => (
        <PickList
          infoKind="spell"
          key={question.key}
          title={`${question.label} — elegi ${question.count}`}
          options={question.options}
          selected={answers[question.key] ?? []}
          limit={question.count}
          accent={accent}
          onToggle={(name) => onToggleSpell(question.key, name)}
        />
      ))}
    </>
  );
}
