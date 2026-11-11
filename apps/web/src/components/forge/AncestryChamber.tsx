import type { ComponentProps } from "react";

import SigilShelf from "@/components/forge/SigilShelf";
import SizeChoice from "@/components/forge/SizeChoice";
import SubChoice from "@/components/forge/SubChoice";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import type { CatalogEntry } from "@/lib/catalog";
import { VAULT_GOLD } from "@/lib/class-tint";

/** The species: its shelf, the branch under it, the size it leaves open, and the spells it asks about. */
export default function AncestryChamber({
  draft,
  patchDraft,
  races,
  raceLabel,
  subraces,
  branchIsRequired,
  sizeOptions,
  variantSources,
  spellChoices,
  onPickRace,
  onPickSubrace,
  onToggleGrantedSpell,
  onChooseVariant,
  onChooseSpellAbility,
}: {
  draft: BuilderState;
  patchDraft: (patch: Partial<BuilderState>) => void;
  races: ComponentProps<typeof SigilShelf>["entries"];
  raceLabel: string | undefined;
  subraces: ComponentProps<typeof SubChoice>["options"];
  branchIsRequired: boolean;
  sizeOptions: ComponentProps<typeof SizeChoice>["options"];
  variantSources: ComponentProps<typeof VariantChoices>["sources"];
  spellChoices: ComponentProps<typeof VariantChoices>["questions"];
  onPickRace: (entry: CatalogEntry) => void;
  onPickSubrace: (entry: CatalogEntry) => void;
  onToggleGrantedSpell: ComponentProps<typeof VariantChoices>["onToggleSpell"];
  onChooseVariant: ComponentProps<typeof VariantChoices>["onPick"];
  onChooseSpellAbility: ComponentProps<typeof VariantChoices>["onPickAbility"];
}) {
  return (
    <div className="space-y-10">
      <SigilShelf
        entries={races}
        selectedId={draft.raceId}
        selectedSource={draft.sourceBooks[`race:${draft.raceId}`]}
        onPick={onPickRace}
        accent={VAULT_GOLD}
        infoKind="race"
        label="Buscar raza"
        placeholder="Buscar entre todas las razas…"
        // The book is what tells two same-named species apart, and
        // a build stores it, so it belongs on the card.
        noteFor={(entry) => entry.source}
      />

      <VariantChoices
        sources={variantSources}
        chosen={draft.spellVariantChoices}
        chosenAbilities={draft.spellAbilityChoices}
        questions={spellChoices}
        answers={draft.grantedSpellChoices}
        onToggleSpell={onToggleGrantedSpell}
        accent={VAULT_GOLD}
        onPick={onChooseVariant}
        onPickAbility={onChooseSpellAbility}
      />

      {/* Only 2014 has these; 2024 folded them into the species. */}
      {subraces.length > 0 && (
        <SubChoice
          infoKind="race"
          infoClass={raceLabel ?? ""}
          title="Rama"
          hint={
            branchIsRequired
              ? `${raceLabel} se divide en ${subraces.length}. Sin elegir una no hay bono de caracteristica ni idioma de especie — no es opcional.`
              : `${raceLabel} se divide en ${subraces.length}. Opcional.`
          }
          options={subraces}
          selectedId={draft.subraceId}
          onPick={onPickSubrace}
          accent={VAULT_GOLD}
        />
      )}

      {/* Thirty species offer two sizes and the books hand the
          choice to the player. Until this existed the first letter
          won, and every one of them exported as Small.

          Below the branch because the offer is read off the merged
          row: no subrace states a size today, and the day one does
          the question has to be asked about the merged species. */}
      {sizeOptions.length > 1 && (
        <SizeChoice
          options={sizeOptions}
          value={draft.sizeChoice}
          accent={VAULT_GOLD}
          onPick={(letter) => patchDraft({ sizeChoice: letter })}
        />
      )}
    </div>
  );
}
