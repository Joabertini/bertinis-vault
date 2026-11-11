import type { ComponentProps } from "react";

import Expertise from "@/components/forge/Expertise";
import PickList from "@/components/forge/PickList";
import VariantChoices from "@/components/forge/VariantChoices";
import type { BuilderState } from "@/lib/builder-state";
import type { expertisePlanFor } from "@/lib/expertise";
import type { assignOffers, proficiencyPlan } from "@/lib/grants";
import type { assignLanguages, languagePlanFor } from "@/lib/languages";
import { DIVIDER, LABEL_MB2, LABEL_MB4, WHISPER, WHISPER_MB4 } from "@/styles/recipes";

/** What the species, background and class hand over, and what they leave to choose. */
export default function GiftsChamber({
  draft,
  raceLabel,
  backgroundLabel,
  speciesGranted,
  otherGranted,
  profPlan,
  offerPicks,
  granted,
  chosenProficiencies,
  expertisePlan,
  langPlan,
  languagePicks,
  chosenLanguages,
  variantSources,
  spellChoices,
  accent,
  onToggleProficiency,
  onAnswerExpertise,
  onToggleLanguage,
  onWriteLanguage,
  onToggleGrantedSpell,
  onChooseVariant,
  onChooseSpellAbility,
}: {
  draft: BuilderState;
  raceLabel: string | undefined;
  backgroundLabel: string | undefined;
  speciesGranted: string[];
  otherGranted: string[];
  profPlan: ReturnType<typeof proficiencyPlan>;
  offerPicks: ReturnType<typeof assignOffers>;
  granted: string[];
  chosenProficiencies: string[];
  expertisePlan: ReturnType<typeof expertisePlanFor>;
  langPlan: ReturnType<typeof languagePlanFor>;
  languagePicks: ReturnType<typeof assignLanguages>;
  chosenLanguages: string[];
  variantSources: ComponentProps<typeof VariantChoices>["sources"];
  spellChoices: ComponentProps<typeof VariantChoices>["questions"];
  accent: string;
  onToggleProficiency: (value: string) => void;
  onAnswerExpertise: ComponentProps<typeof Expertise>["onAnswer"];
  onToggleLanguage: (value: string) => void;
  onWriteLanguage: (value: string) => void;
  onToggleGrantedSpell: ComponentProps<typeof VariantChoices>["onToggleSpell"];
  onChooseVariant: ComponentProps<typeof VariantChoices>["onPick"];
  onChooseSpellAbility: ComponentProps<typeof VariantChoices>["onPickAbility"];
}) {
  return (
    <div className="space-y-10">
      {/*
        * Who gave it, and not one heap.
        *
        * The species and the background both hand things over, and
        * they are not interchangeable: a player checking whether
        * they wrote their elf's Perception down needs to see it
        * under the elf. Naming the background over a species grant
        * was worse than saying nothing.
        */}
      {speciesGranted.length > 0 && (
        <div>
          <p className={LABEL_MB4}>
            Otorgado por {raceLabel ?? "la especie"}
          </p>
          <div className="flex flex-wrap gap-2">
            {speciesGranted.map((entry) => (
              <span
                key={entry}
                className="border px-3 py-1.5 font-body text-[15px]"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      )}

      {otherGranted.length > 0 && (
        <div>
          <p className={LABEL_MB4}>
            Otorgado por {backgroundLabel ?? "el trasfondo"}
          </p>
          <div className="flex flex-wrap gap-2">
            {otherGranted.map((entry) => (
              <span
                key={entry}
                className="border px-3 py-1.5 font-body text-[15px]"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      )}

      {profPlan.offers.map((offer, index) =>
        /*
         * An offer the data states as a kind — "any artisan's
         * tools", "any musical instrument" — has no list to pick
         * from, and inventing one would be inventing a rule. It is
         * said instead, next to the field the player writes in.
         */
        offer.scope ? (
          <div key={`${offer.from}-${index}`}>
            <p className={LABEL_MB2}>Herramientas — {offer.label ?? offer.from}</p>
            <p className="font-body text-bone">
              {/* Named rather than assumed: this used to say "tu
                  especie" for every one of them, and feats offer
                  these too. */}
              {offer.label ?? `Tu ${offer.from}`} te da {offer.count}{" "}
              {offer.scope === "artisan"
                ? offer.count === 1
                  ? "herramienta de artesano"
                  : "herramientas de artesano"
                : offer.count === 1
                  ? "instrumento musical"
                  : "instrumentos musicales"}{" "}
              a eleccion. Escribi cual abajo.
            </p>
          </div>
        ) : (
          <PickList
            infoKind={offer.kind === "tool" ? "item" : "skill"}
            key={`${offer.from}-${index}`}
            title={`${offer.kind === "tool" ? "Herramientas" : "Competencias"} — ${offer.label ?? offer.from}`}
            hint={
              offer.note ??
              (offer.isOpen
                ? "Cualquier habilidad."
                : `Elegi ${offer.count} de esta lista.`)
            }
            options={offer.options}
            // Only what this offer paid for. Handed the whole list,
            // each picker counted the other's picks against its own
            // limit and locked itself before a single choice was
            // made in it.
            selected={offerPicks[index] ?? []}
            // Already proficient, from the background or from
            // another offer: shown as had, never as choosable twice.
            locked={[
              ...granted,
              ...chosenProficiencies.filter(
                (entry) => !(offerPicks[index] ?? []).includes(entry),
              ),
            ]}
            limit={offer.count}
            accent={accent}
            onToggle={onToggleProficiency}
          />
        ),
      )}

      {profPlan.offers.length === 0 && (
        <p className={WHISPER}>
          Ni la clase, ni el trasfondo, ni la especie, ni tus dotes ofrecen nada a
          elección.
        </p>
      )}

      {/* After the skills, not before: you double what you have
          already picked, so asking first would offer an empty pool. */}
      {expertisePlan.slots.length > 0 && (
        <div className={DIVIDER}>
          <Expertise
            slots={expertisePlan.slots}
            proficientSkills={expertisePlan.proficientSkills}
            proficientTools={expertisePlan.proficientTools}
            accent={accent}
            onAnswer={onAnswerExpertise}
          />
        </div>
      )}

      <div className={DIVIDER}>
        <p className={LABEL_MB4}>
          Idiomas
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          {langPlan.fixed.map((entry) => (
            <span
              key={entry}
              className="border px-3 py-1.5 font-body text-[15px]"
              style={{ borderColor: `${accent}55`, color: accent }}
            >
              {entry}
            </span>
          ))}
        </div>

        {langPlan.offers.map((offer, index) => (
          <div key={`${offer.from}-${index}`} className="mb-6">
            {offer.options.length > 0 && (
              <PickList
                infoKind="language"
                title={
                  offer.from === "especie"
                    ? "Idiomas de tu especie"
                    : "Idiomas de tu trasfondo"
                }
                hint={`Elegi ${offer.count} de esta lista.`}
                options={offer.options}
                // Only what this offer paid for. Handed the whole
                // list, each picker counted the other's picks
                // against its own limit and locked itself before a
                // single choice was made in it.
                selected={languagePicks[index] ?? []}
                locked={[
                  ...langPlan.fixed,
                  ...chosenLanguages.filter(
                    (entry) => !(languagePicks[index] ?? []).includes(entry),
                  ),
                ]}
                limit={offer.count}
                accent={accent}
                onToggle={onToggleLanguage}
              />
            )}

            {/*
              The slot the book refuses to turn into a list: "any
              language that you and your DM agree is appropriate".
              Offering the standard eight for it would be inventing
              a rule, so it is written by hand.
            */}
            {offer.isOpen && (
              <div className={offer.options.length > 0 ? "mt-4" : ""}>
                <p className={LABEL_MB2}>
                  {offer.options.length > 0
                    ? "O uno que acuerdes con tu DM"
                    : offer.count === 1
                      ? "Un idioma a convenir con tu DM"
                      : `${offer.count} idiomas a convenir con tu DM`}
                </p>
                <p className={WHISPER_MB4}>
                  {offer.from === "especie" ? "Tu especie" : "Tu trasfondo"} no dice
                  cual. Escribilo.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(languagePicks[index] ?? [])
                    .filter((entry) => !offer.options.includes(entry))
                    .map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => onToggleLanguage(entry)}
                        className="border px-3 py-1.5 font-body text-[15px]"
                        style={{ borderColor: `${accent}55`, color: accent }}
                      >
                        {entry} ×
                      </button>
                    ))}
                </div>
                <input
                  type="text"
                  placeholder="Escribilo y presiona Enter"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    onWriteLanguage(event.currentTarget.value);
                    event.currentTarget.value = "";
                  }}
                  className="w-full border bg-transparent px-3 py-2 font-body text-[15px] text-bone outline-none"
                  style={{ borderColor: `${accent}33` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
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
