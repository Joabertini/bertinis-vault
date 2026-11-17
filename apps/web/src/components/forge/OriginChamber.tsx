import type { ComponentProps } from "react";

import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import BackgroundGrant from "@/components/forge/BackgroundGrant";
import SigilShelf from "@/components/forge/SigilShelf";
import { backgroundIconKey } from "@/lib/icons";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import type { CatalogEntry } from "@/lib/catalog";
import { backgroundFeatIdsFor, chosenFeatBenefit, featBenefitKey } from "@/lib/feats";
import { CUSTOM_BACKGROUND_ID, CUSTOM_BACKGROUND_NAME } from "@bertinis-vault/contracts";
import { DIVIDER, WHISPER } from "@/styles/recipes";

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
  const custom = draft.backgroundId === CUSTOM_BACKGROUND_ID;

  return (
    <div className="space-y-10">
      {/*
        B2: the DMG 2024 lets a DM build a background. A table rule, so it is
        offered and starts off; the player turns it on if their table uses it.
      */}
      {rulesVersion === "2024" && (
        <button
          type="button"
          aria-pressed={custom}
          onClick={() =>
            custom
              ? patchDraft({ backgroundId: "", backgroundFeatId: "" })
              : onPickBackground({
                  id: CUSTOM_BACKGROUND_ID,
                  label: CUSTOM_BACKGROUND_NAME,
                  source: "XDMG",
                  shared: false,
                })
          }
          className="flex items-start gap-3 text-left"
        >
          <span
            className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[13px]"
            style={{
              borderColor: custom ? accent : "#5A5A5A",
              background: custom ? accent : "transparent",
              color: "#0B0B0B",
            }}
          >
            {custom ? "✓" : ""}
          </span>
          <span className="font-body text-sm leading-relaxed text-bone">
            Trasfondo a medida{" "}
            <span className="text-bone">
              (Guia del DM 2024). Regla de mesa: armas tu propio trasfondo con tres
              caracteristicas, una dote de Origen, dos habilidades, una herramienta y 50 po de
              equipo. Preguntale a tu DM si la usan.
            </span>
          </span>
        </button>
      )}

      {!custom && <SigilShelf
        entries={backgrounds}
        selectedId={draft.backgroundId}
        selectedSource={draft.sourceBooks[`background:${draft.backgroundId}`]}
        onPick={onPickBackground}
        accent={accent}
        infoKind="background"
        iconFor={(entry) => backgroundIconKey(entry.label)}
        label="Buscar trasfondo"
        placeholder="Buscar entre todos los trasfondos…"
        noteFor={(entry) => entry.source}
      />}

      {custom && (
        <p className={WHISPER}>
          Las caracteristicas se reparten en Mejora de caracteristica (+2 y +1, o +1 a tres); las dos
          habilidades y la herramienta, en Dones; los 50 po, en Equipo.
        </p>
      )}

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
              benefit={chosenFeatBenefit(draft, backgroundFeatIdsFor(draft)[0] ?? "") ?? ""}
              onPickBenefit={(featId, name) => {
                const next = { ...draft.spellVariantChoices };
                if (name) next[featBenefitKey(featId)] = name;
                else delete next[featBenefitKey(featId)];
                patchDraft({ spellVariantChoices: next });
              }}
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
