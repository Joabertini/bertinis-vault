import type { ComponentProps } from "react";

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import BackgroundGrant from "@/components/forge/BackgroundGrant";
import SigilShelf from "@/components/forge/SigilShelf";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import type { CatalogEntry } from "@/lib/catalog";
import { DIVIDER } from "@/styles/recipes";

/** The background: its shelf, what it hands you, and the spell questions it opens. */
export default function OriginChamber({
  draft,
  patchDraft,
  rulesVersion,
  backgrounds,
  selectedBackground,
  variantSources,
  spellChoices,
  accent,
  onPickBackground,
  onToggleGrantedSpell,
  onChooseVariant,
  onChooseSpellAbility,
}: {
  draft: BuilderState;
  patchDraft: (patch: Partial<BuilderState>) => void;
  rulesVersion: RulesVersion;
  backgrounds: ComponentProps<typeof SigilShelf>["entries"];
  selectedBackground: { label: string; source: string } | null | undefined;
  variantSources: ComponentProps<typeof VariantChoices>["sources"];
  spellChoices: ComponentProps<typeof VariantChoices>["questions"];
  accent: string;
  onPickBackground: (entry: CatalogEntry) => void;
  onToggleGrantedSpell: ComponentProps<typeof VariantChoices>["onToggleSpell"];
  onChooseVariant: ComponentProps<typeof VariantChoices>["onPick"];
  onChooseSpellAbility: ComponentProps<typeof VariantChoices>["onPickAbility"];
}) {
  return (
    <div className="space-y-10">
      <SigilShelf
        entries={backgrounds}
        selectedId={draft.backgroundId}
        selectedSource={draft.sourceBooks[`background:${draft.backgroundId}`]}
        onPick={onPickBackground}
        accent={accent}
        infoKind="background"
        label="Buscar trasfondo"
        placeholder="Buscar entre todos los trasfondos…"
        noteFor={(entry) => entry.source}
      />

      {/* What it hands you. Everything on this panel is read off
          the index; the prose that 5etools prints alongside is not
          in there at all. See BackgroundGrant.tsx. */}
      {selectedBackground && (
        <div className={DIVIDER}>
          <p className="font-display text-lg font-bold" style={{ color: accent }}>
            {selectedBackground.label}
            <span className="ml-3 font-mono text-[13px] font-normal uppercase tracking-[0.1em] text-bone">
              {selectedBackground.source}
            </span>
          </p>
          <div className="mt-5">
            <BackgroundGrant
              backgroundId={draft.backgroundId}
              rulesVersion={rulesVersion}
              sourceBook={draft.sourceBooks[`background:${draft.backgroundId}`]}
              accent={accent}
              featId={draft.backgroundFeatId}
              onPickFeat={(backgroundFeatId) => patchDraft({ backgroundFeatId })}
            />
          </div>
        </div>
      )}
      <VariantChoices
        sources={variantSources}
        chosen={draft.spellVariantChoices}
        chosenAbilities={draft.spellAbilityChoices}
        questions={spellChoices}
        answers={draft.grantedSpellChoices}
        onToggleSpell={onToggleGrantedSpell}
        accent={accent}
        onPick={onChooseVariant}
        onPickAbility={onChooseSpellAbility}
      />

    </div>
  );
}
