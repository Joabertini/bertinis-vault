import type { ComponentProps } from "react";

import SigilShelf from "@/components/forge/SigilShelf";
import { speciesIconKey } from "@/lib/icons";
import ScryPicker from "@/components/forge/ScryPicker";
import SizeChoice from "@/components/forge/SizeChoice";
import SubChoice from "@/components/forge/SubChoice";
import TalentPools from "@/components/forge/TalentPools";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import type { CatalogEntry } from "@/lib/catalog";
import { VAULT_GOLD } from "@/lib/class-tint";
import { ORIGIN_FEAT_IDS, speciesFeatGrantFor } from "@/lib/feats";
import { kindIconKey } from "@/lib/icons";
import { optionsFor } from "@/lib/index-options";

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
  pools,
  chosenTalents,
  accent,
  onToggleTalent,
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
  /** The species' printed choices: a dragonborn's ancestry, a goliath's giant. */
  pools: ComponentProps<typeof TalentPools>["pools"];
  chosenTalents: string[];
  accent: string;
  onToggleTalent: ComponentProps<typeof TalentPools>["onToggle"];
}) {
  const featGrant = speciesFeatGrantFor(draft);
  const edition = draft.rulesVersion === "5e-2024" ? "2024" : "2014";
  // A human's feat is a question of its own: Versatile in 2024 takes an origin
  // feat, the variant human and the custom lineage take any.
  const featSearch = (query: string): CatalogEntry[] =>
    optionsFor({ prop: "feat", rulesVersion: edition, search: query, limit: null }).filter(
      (entry) => featGrant !== "origin" || ORIGIN_FEAT_IDS.has(entry.id),
    );

  return (
    <div className="space-y-10">
      <SigilShelf
        entries={races}
        selectedId={draft.raceId}
        selectedSource={draft.sourceBooks[`race:${draft.raceId}`]}
        onPick={onPickRace}
        accent={VAULT_GOLD}
        infoKind="race"
        iconFor={(entry) => speciesIconKey(entry.label)}
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

      <TalentPools pools={pools} chosen={chosenTalents} accent={accent} onToggle={onToggleTalent} />

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

      {featGrant && (
        <div className="space-y-2">
          <ScryPicker
            label={featGrant === "origin" ? "Dote de origen (Versatile)" : "Dote de la especie"}
            placeholder="Buscar dote…"
            search={featSearch}
            infoKind="feat"
            iconFor={() => kindIconKey("feat")}
            selectedId={draft.featId}
            onPick={(entry: CatalogEntry) => patchDraft({ featId: draft.featId === entry.id ? "" : entry.id })}
            accent={VAULT_GOLD}
          />
          <p className="font-body text-sm text-bone/70">
            {featGrant === "origin"
              ? "Se suma a la dote del trasfondo."
              : "Se suma a las dotes de nivel. Podés cambiarla o dejarla vacía."}
          </p>
        </div>
      )}
    </div>
  );
}
