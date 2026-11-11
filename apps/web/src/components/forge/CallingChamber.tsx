import type { ComponentProps } from "react";

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import HitPoints from "@/components/forge/HitPoints";
import Multiclass from "@/components/forge/Multiclass";
import SigilShelf from "@/components/forge/SigilShelf";
import SubChoice from "@/components/forge/SubChoice";
import TalentPools from "@/components/forge/TalentPools";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import { hitDieFor, type CatalogEntry } from "@/lib/catalog";
import { DIVIDER, DIVIDER_TIGHT } from "@/styles/recipes";

/** The class: its shelf, level, subclass, what it lets you choose, hit points and multiclass. */
export default function CallingChamber({
  draft,
  patchDraft,
  rulesVersion,
  classes,
  classLabel,
  groupFor,
  primaryLevelCeiling,
  subclassUnlocked,
  subclassLevel,
  subclasses,
  variantSources,
  spellChoices,
  pools,
  hitPointLevels,
  firstHitDie,
  constitutionModifier,
  multiclassProblems,
  accent,
  onPickClass,
  onSetLevel,
  onPickSubclass,
  onToggleGrantedSpell,
  onChooseVariant,
  onChooseSpellAbility,
  onToggleTalent,
  onSetHitPointRoll,
  onChangeClass,
  onRemoveClass,
  onAddClass,
}: {
  draft: BuilderState;
  patchDraft: (patch: Partial<BuilderState>) => void;
  rulesVersion: RulesVersion;
  classes: ComponentProps<typeof SigilShelf>["entries"];
  classLabel: string | undefined;
  groupFor: ComponentProps<typeof SigilShelf>["groupFor"];
  primaryLevelCeiling: number;
  subclassUnlocked: boolean;
  subclassLevel: number;
  subclasses: ComponentProps<typeof SubChoice>["options"];
  variantSources: ComponentProps<typeof VariantChoices>["sources"];
  spellChoices: ComponentProps<typeof VariantChoices>["questions"];
  pools: ComponentProps<typeof TalentPools>["pools"];
  hitPointLevels: ComponentProps<typeof HitPoints>["levels"];
  firstHitDie: number;
  constitutionModifier: number;
  multiclassProblems: ComponentProps<typeof Multiclass>["problems"];
  accent: string;
  onPickClass: (entry: CatalogEntry) => void;
  onSetLevel: (level: number) => void;
  onPickSubclass: (entry: CatalogEntry) => void;
  onToggleGrantedSpell: ComponentProps<typeof VariantChoices>["onToggleSpell"];
  onChooseVariant: ComponentProps<typeof VariantChoices>["onPick"];
  onChooseSpellAbility: ComponentProps<typeof VariantChoices>["onPickAbility"];
  onToggleTalent: ComponentProps<typeof TalentPools>["onToggle"];
  onSetHitPointRoll: ComponentProps<typeof HitPoints>["onRoll"];
  onChangeClass: ComponentProps<typeof Multiclass>["onChange"];
  onRemoveClass: ComponentProps<typeof Multiclass>["onRemove"];
  onAddClass: ComponentProps<typeof Multiclass>["onAdd"];
}) {
  return (
    <div className="space-y-10">
      <SigilShelf
        entries={classes}
        selectedId={draft.classId}
        selectedSource={draft.sourceBooks[`class:${draft.classId}`]}
        groupFor={groupFor}
        onPick={onPickClass}
        accent={accent}
        infoKind="class"
        label="Buscar clase"
        placeholder="Buscar entre todas las clases…"
        noteFor={(entry) => {
          const die = hitDieFor(entry.id, rulesVersion);
          // The die is the shortest true thing that separates one
          // class from another before you have read either.
          return die ? `d${die} · ${entry.source}` : entry.source;
        }}
      />

      {draft.classId && (
        <div className={DIVIDER}>
          <label className="mb-4 block font-mono text-[13px] tracking-[0.1em] uppercase text-bone">
            Nivel de poder — <span style={{ color: accent }}>{draft.level}</span>
          </label>
          <input
            type="range"
            min={1}
            // Twenty levels between every class. Letting this reach
            // 20 with levels already spent elsewhere would show a
            // level the sheet then silently clamps back down.
            max={primaryLevelCeiling}
            value={draft.level}
            onChange={(event) => onSetLevel(Number(event.target.value))}
            className="w-full accent-gold"
            aria-label="Nivel"
          />
        </div>
      )}

      {draft.classId &&
        (subclassUnlocked ? (
          subclasses.length > 0 && (
            <SubChoice
              infoClass={classLabel ?? ""}
              title="Senda"
              hint={`${classLabel} elige a nivel ${subclassLevel}. ${subclasses.length} disponibles.`}
              options={subclasses}
              selectedId={draft.subclassId}
              onPick={onPickSubclass}
              accent={accent}
            />
          )
        ) : (
          <div className={DIVIDER_TIGHT}>
            <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
              Senda
            </p>
            <p className="mt-3 font-body text-bone">
              {classLabel} no elige senda hasta el nivel {subclassLevel}.
            </p>
          </div>
        ))}

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

      {/*
        A fighting style is a level 1 class feature, and it used to
        be asked in Mejoras — the chamber a player opens at level 4
        to spend an improvement. So the builder answered a question
        about the level they had just reached with a question about
        the level they started at, and refused to move on until
        they settled it. Players read that as a bug in the
        improvement, which is a fair reading of where it appeared.

        It belongs with the rest of what the class hands over:
        after the subclass and its variants, before the hit points.
      */}
      {pools.length > 0 && (
        <div className={DIVIDER}>
          <p className="mb-6 font-body text-[15px] leading-relaxed text-bone">
            Lo que {classLabel} te deja elegir a nivel {draft.level}.
          </p>
          <TalentPools
            pools={pools}
            chosen={draft.optionalFeatureIds}
            accent={accent}
            onToggle={onToggleTalent}
          />
        </div>
      )}

      {draft.classId && (
        <HitPoints
          method={draft.hpMethod}
          levels={hitPointLevels}
          firstDie={firstHitDie}
          constitutionModifier={constitutionModifier}
          classLabel={(id) => classes.find((entry) => entry.id === id)?.label ?? id}
          accent={accent}
          onPickMethod={(hpMethod) => patchDraft({ hpMethod })}
          onRoll={onSetHitPointRoll}
        />
      )}

      {draft.classId && (
        <Multiclass
          extras={draft.extraClasses}
          classes={classes}
          primaryClassId={draft.classId}
          primaryLevel={draft.level}
          rulesVersion={rulesVersion}
          accent={accent}
          problems={multiclassProblems}
          onChange={onChangeClass}
          onRemove={onRemoveClass}
          onAdd={onAddClass}
        />
      )}
    </div>
  );
}
