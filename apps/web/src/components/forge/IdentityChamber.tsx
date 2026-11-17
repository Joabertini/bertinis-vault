import CoverPicker from "@/components/codex/CoverPicker";
import TokenPicker from "@/components/codex/TokenPicker";
import ForgeField from "@/components/forge/ForgeField";
import type { BuilderState } from "@/lib/builder-state";
import { LABEL } from "@/styles/recipes";

/** The last chamber: names, the character's own words, and how they look. */
export default function IdentityChamber({
  draft,
  patchDraft,
  onSuggestLooks,
}: {
  draft: BuilderState;
  patchDraft: (patch: Partial<BuilderState>) => void;
  onSuggestLooks: () => void;
}) {
  return (
    <div className="max-w-lg space-y-8">
      <ForgeField label="Nombre verdadero">
        <input
          value={draft.characterName}
          onChange={(event) => patchDraft({ characterName: event.target.value })}
          placeholder="Decilo en la oscuridad…"
          className="w-full border-b border-iron bg-transparent pb-3 font-display text-3xl text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
        />
      </ForgeField>

      <ForgeField label="Nombre del jugador">
        <input
          value={draft.playerName}
          onChange={(event) => patchDraft({ playerName: event.target.value })}
          placeholder="Quien sostiene la pluma"
          className="w-full border-b border-iron bg-transparent pb-2 font-body text-lg text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
        />
      </ForgeField>

      <ForgeField label="Alineamiento">
        <input
          value={draft.alignment}
          onChange={(event) => patchDraft({ alignment: event.target.value })}
          placeholder="Neutral bueno…"
          className="w-full border-b border-iron bg-transparent pb-2 font-body text-lg text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
        />
      </ForgeField>

      <CoverPicker
        value={draft.coverImage}
        classId={draft.classId}
        name={draft.characterName}
        onChange={(coverImage) => patchDraft({ coverImage })}
      />

      <TokenPicker
        value={draft.tokenImage}
        portrait={draft.coverImage}
        onChange={(tokenImage) => patchDraft({ tokenImage })}
      />

      {/* These travel in the payload's `identity.biography` and
          were being dropped entirely. */}
      <div className="space-y-6 border-t border-iron/40 pt-8">
        <p className={LABEL}>
          Lo que te hace vos
        </p>

        {(
          [
            ["trait", "Rasgo", "Siempre toma notas, incluso en el peligro."],
            ["ideal", "Ideal", "El conocimiento es la mejor defensa."],
            ["bond", "Vinculo", "Su mentor desaparecido dejo pistas."],
            ["flaw", "Defecto", "No abandona una pista, aunque arriesgue al grupo."],
          ] as const
        ).map(([field, label, placeholder]) => (
          <ForgeField key={field} label={label}>
            <input
              value={draft[field]}
              onChange={(event) => patchDraft({ [field]: event.target.value })}
              placeholder={placeholder}
              className="w-full border-b border-iron bg-transparent pb-2 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
            />
          </ForgeField>
        ))}

        <ForgeField label="Notas">
          <textarea
            value={draft.notes}
            onChange={(event) => patchDraft({ notes: event.target.value })}
            rows={3}
            placeholder="Lo que no entra en ninguna casilla."
            className="w-full resize-none border border-iron bg-transparent p-3 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
          />
        </ForgeField>
      </div>

      {/* The nine boxes the dnd5e sheet already draws. They are
          fields of `system.details`, so what is written here lands
          in the boxes rather than as prose in the biography blob —
          which is where the description used to go, when it went
          anywhere at all. */}
      <div className="space-y-6 border-t border-iron/40 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={LABEL}>Como te ven</p>
          {draft.raceId && (
            <button
              type="button"
              onClick={onSuggestLooks}
              className="border border-iron/70 px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:border-gold hover:text-gold"
            >
              Sugerir por especie
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {(
            [
              ["age", "Edad", "27"],
              ["height", "Altura", "1,75 m"],
              ["weight", "Peso", "70 kg"],
              ["eyes", "Ojos", "Grises"],
              ["hair", "Pelo", "Negro, corto"],
              ["skin", "Piel", "Palida"],
              ["gender", "Genero", ""],
              ["faith", "Fe", "Ninguna"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <ForgeField key={field} label={label}>
              <input
                value={draft[field]}
                onChange={(event) => patchDraft({ [field]: event.target.value })}
                placeholder={placeholder}
                className="w-full border-b border-iron bg-transparent pb-2 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
              />
            </ForgeField>
          ))}
        </div>

        <ForgeField label="Aspecto">
          <textarea
            value={draft.appearance}
            onChange={(event) => patchDraft({ appearance: event.target.value })}
            rows={3}
            placeholder="Lo primero que nota alguien que te cruza."
            className="w-full resize-none border border-iron bg-transparent p-3 font-body text-base text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
          />
        </ForgeField>
      </div>
    </div>
  );
}
