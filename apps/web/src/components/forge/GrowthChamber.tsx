import type { ComponentProps } from "react";

import BonusEditor from "@/components/forge/BonusEditor";
import Improvements from "@/components/forge/Improvements";
import OriginBonus from "@/components/forge/OriginBonus";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import { bonusOrigin, maxPointsPerAbility } from "@/lib/improvements";
import { LABEL, WHISPER } from "@/styles/recipes";

/** Where the species or background increase lands, the level-up choices, and what they open. */
export default function GrowthChamber({
  draft,
  patchDraft,
  rulesVersion,
  printedBonus,
  speciesBudget,
  originAllowance,
  slots,
  variantSources,
  spellChoices,
  accent,
  onSetChoice,
  onSetFeatAbilities,
  onToggleGrantedSpell,
  onChooseVariant,
  onChooseSpellAbility,
}: {
  draft: BuilderState;
  patchDraft: (patch: Partial<BuilderState>) => void;
  rulesVersion: BuilderState["rulesVersion"];
  printedBonus: ComponentProps<typeof OriginBonus>["printed"];
  speciesBudget: ComponentProps<typeof BonusEditor>["budget"];
  originAllowance: ComponentProps<typeof BonusEditor>["allowed"];
  slots: ComponentProps<typeof Improvements>["slots"];
  variantSources: ComponentProps<typeof VariantChoices>["sources"];
  spellChoices: ComponentProps<typeof VariantChoices>["questions"];
  accent: string;
  onSetChoice: ComponentProps<typeof Improvements>["onSetChoice"];
  onSetFeatAbilities: ComponentProps<typeof Improvements>["onSetFeatAbilities"];
  onToggleGrantedSpell: ComponentProps<typeof VariantChoices>["onToggleSpell"];
  onChooseVariant: ComponentProps<typeof VariantChoices>["onPick"];
  onChooseSpellAbility: ComponentProps<typeof VariantChoices>["onPickAbility"];
}) {
  return (
    <div className="space-y-12">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className={LABEL}>
            Aumento de {bonusOrigin(rulesVersion)}
          </span>
          <span className={WHISPER}>
            {rulesVersion === "2024"
              ? "En 2024 el aumento lo da el trasfondo: repartilo vos."
              : "Sembrado desde el indice. Podes cambiarlo."}
          </span>
        </div>
        <p className="mb-3 font-body text-[15px] leading-relaxed text-bone">
          Se suma a los puntajes ligados. Sin esto un enano exporta sin su +2 a
          Constitucion.
        </p>

        {/*
          2014 hands out blocks and Tasha's moves them whole; 2024
          moved the increase to the background, where it really is
          a small budget the player spends. Two rules, two editors —
          one editor for both was what let a gnome be +1/+1/+1.
        */}
        {rulesVersion === "2014" ? (
          <OriginBonus
            printed={printedBonus}
            bonuses={draft.abilityBonuses}
            custom={draft.customOrigin}
            accent={accent}
            onToggleCustom={(customOrigin) =>
              patchDraft({
                customOrigin,
                // Turning it off puts the increase back where the
                // book prints it, which is the whole meaning of
                // turning it off.
                ...(customOrigin ? {} : { abilityBonuses: printedBonus }),
              })
            }
            onChange={(abilityBonuses) => patchDraft({ abilityBonuses })}
          />
        ) : (
          <BonusEditor
            bonuses={draft.abilityBonuses}
            scoresBefore={{
              str: draft.str,
              dex: draft.dex,
              con: draft.con,
              int: draft.int,
              wis: draft.wis,
              cha: draft.cha,
            }}
            budget={speciesBudget}
            maxPerAbility={maxPointsPerAbility}
            allowed={originAllowance}
            accent={accent}
            onChange={(abilityBonuses) => patchDraft({ abilityBonuses })}
          />
        )}
      </div>

      <Improvements
        state={draft}
        slots={slots}
        rulesVersion={rulesVersion}
        accent={accent}
        onSetChoice={onSetChoice}
        onSetFeatAbilities={onSetFeatAbilities}
      />
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
