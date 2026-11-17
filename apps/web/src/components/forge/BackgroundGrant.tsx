/**
 * What a background actually hands the character.
 *
 * The chamber used to show a name and a book and nothing else, so choosing
 * between 161 backgrounds meant choosing between 161 strings. Every one of
 * them grants skills, most grant tools, many grant a feat, and 134 of the 161
 * carry a starting equipment list — all of it already in the index, none of it
 * on screen.
 *
 * Mechanics only, and that is a limit rather than a preference: the index
 * carries no prose at all. Not for backgrounds, not for species, not for
 * spells. There is no summary to show and no full text behind a link, because
 * the data does not exist on this side. Bringing it over means changing the
 * index, which is a repo change. See CONTEXT.md.
 *
 * Granted and chosen are kept apart. A skill the background simply gives you
 * is not a decision, and drawing it like one invites a player to try to
 * decline something they cannot.
 */

import { motion } from "framer-motion";

import { useInfo } from "@/components/info/info-context";

import { CORE_SOURCES, getSourceMeta, type RulesVersion } from "@bertinis-vault/vetools-ref";

import {
  featChoiceForBackground,
  featOptionLabel,
  proficiencyGrantForBackground,
  slugOf,
  startingEquipmentForBackground,
} from "@/lib/index-options";
import { featBenefitsFor, type FeatBenefit } from "@/lib/feats";
import { WHISPER } from "@/styles/recipes";

export default function BackgroundGrant({
  backgroundId,
  rulesVersion,
  sourceBook,
  accent,
  featId,
  onPickFeat,
  benefit = "",
  onPickBenefit,
}: {
  backgroundId: string;
  rulesVersion: RulesVersion;
  sourceBook?: string | undefined;
  accent: string;
  /** The feat already answered for, empty while the question is open. */
  featId: string;
  onPickFeat: (id: string) => void;
  /** The benefit chosen for the granted feat, when the feat asks for one. */
  benefit?: string;
  onPickBenefit?: (featId: string, name: string) => void;
}) {
  const grant = proficiencyGrantForBackground(backgroundId, rulesVersion, sourceBook);
  const feat = featChoiceForBackground(backgroundId, rulesVersion, sourceBook);
  const gear = startingEquipmentForBackground(backgroundId, rulesVersion, sourceBook);

  const nothing =
    grant.skillsGranted.length === 0 &&
    grant.toolsGranted.length === 0 &&
    !grant.skillChoice &&
    !feat &&
    gear.length === 0;

  if (nothing) {
    return (
      <p className="font-body text-[15px] text-bone">
        El indice no registra que este trasfondo otorgue nada.
      </p>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <Line label="Competencias" accent={accent} items={grant.skillsGranted} />
      <Line label="Herramientas" accent={accent} items={grant.toolsGranted} />

      {grant.skillChoice && (
        <Line
          label={`Elegis ${grant.skillChoice.count} de`}
          accent={accent}
          items={
            grant.skillChoice.options.length
              ? grant.skillChoice.options
              : ["cualquier habilidad: se eligen en Dones"]
          }
          chosen
        />
      )}

      {feat &&
        (feat.options.length > 1 ? (
          <FeatChoice
            rulesVersion={rulesVersion}
            options={feat.options}
            value={featId}
            accent={accent}
            onPick={onPickFeat}
          />
        ) : (
          <Line label="Dote" accent={accent} items={feat.options.map(featOptionLabel)} />
        ))}

      {/* A granted feat that asks its own question, like Strike of the Giants. */}
      {feat &&
        onPickBenefit &&
        (() => {
          const grantedId =
            feat.options.length === 1 ? slugOf((feat.options[0] as { name: string }).name) : featId;
          const benefits = grantedId ? featBenefitsFor(grantedId) : [];
          return benefits.length > 0 ? (
            <BenefitChoice
              benefits={benefits}
              value={benefit}
              accent={accent}
              onPick={(name) => onPickBenefit(grantedId, name)}
            />
          ) : null;
        })()}

      {gear.length > 0 && (
        <Line label="Equipo inicial" accent={accent} items={gear} muted />
      )}
    </motion.div>
  );
}

/**
 * The feat a background offers a choice of.
 *
 * Drawn as buttons rather than as chips because it is the only row here that
 * is a question. It used to be drawn like the rest — three names in a box that
 * could not be pressed — so `backgroundFeatId` was never written and the
 * chamber would not let anyone past. Two backgrounds ask this: Ruined and
 * Rewarded, both 2014.
 *
 * Pressing the chosen one again clears it. A background can be reconsidered,
 * and a question with no way back to unanswered is a trap.
 */
function FeatChoice({
  rulesVersion,
  options,
  value,
  accent,
  onPick,
}: {
  rulesVersion: RulesVersion;
  options: { name: string; source?: string; qualifier?: string }[];
  value: string;
  accent: string;
  onPick: (id: string) => void;
}) {
  const info = useInfo();
  const groups = groupBySource(options, rulesVersion);

  return (
    <div>
      <p className="mb-2 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
        Elegis una dote
      </p>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.source}>
            <div className="mb-1.5 flex items-baseline gap-2.5 border-b border-iron/30 pb-1">
              <span className="font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: accent }}>
                {group.source}
              </span>
              <span className="flex-1 font-body text-sm text-bone">{group.title}</span>
              <span className="font-mono text-[12px] text-bone/50">{group.options.length}</span>
            </div>
            <div className="grid gap-0.5 sm:grid-cols-2">
              {group.options.map((option) => {
                const id = slugOf(option.name);
                const chosen = id === value;

                return (
                  <button
                    key={`${id}:${option.qualifier ?? ""}`}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => {
                      // Touching a feat also says what it does: the choice is blind otherwise.
                      info.show({ kind: "feat", name: option.name, ...(option.source ? { source: option.source } : {}) });
                      onPick(chosen ? "" : id);
                    }}
                    className="flex items-center gap-3 border-l-2 px-3 py-1.5 text-left transition-colors"
                    style={{
                      borderLeftColor: chosen ? accent : "transparent",
                      background: chosen ? `${accent}1f` : "transparent",
                    }}
                  >
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[13px]"
                      style={{ borderColor: chosen ? accent : "#5A5A5A", color: accent }}
                    >
                      {chosen ? "✦" : ""}
                    </span>
                    <span
                      className="font-body text-[15px]"
                      style={{ color: chosen ? accent : "#FFFFFF" }}
                    >
                      {featOptionLabel(option)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Says why the next chamber is closed, which is otherwise invisible. */}
      {!value && <p className={`mt-2 ${WHISPER}`}>Elegi una para seguir.</p>}
    </div>
  );
}

/** Titles for the sources the generated table does not carry. */
const EXTRA_SOURCE_TITLES: Record<string, string> = {
  FRHOF: "Forgotten Realms: Heroes of Faerûn",
  SATO: "Sigil and the Outlands",
  DSOTDQ: "Dragonlance: Shadow of the Dragon Queen",
};

/**
 * The options grouped by the book they come from: the edition's own handbook
 * first, then the rest from the newest book to the oldest, each book A to Z.
 */
function groupBySource<T extends { name: string; source?: string }>(options: T[], rulesVersion: RulesVersion) {
  const bySource = new Map<string, T[]>();
  for (const option of options) {
    const source = option.source ?? "—";
    bySource.set(source, [...(bySource.get(source) ?? []), option]);
  }
  const core = CORE_SOURCES[rulesVersion];

  return [...bySource.entries()]
    .map(([source, list]) => ({
      source,
      title: getSourceMeta(source)?.full ?? EXTRA_SOURCE_TITLES[source] ?? source,
      date: getSourceMeta(source)?.date ?? "",
      options: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      const ca = core.includes(a.source) ? 0 : 1;
      const cb = core.includes(b.source) ? 0 : 1;
      return ca - cb || b.date.localeCompare(a.date) || a.source.localeCompare(b.source);
    });
}

/**
 * The benefit a granted feat makes the player pick.
 *
 * Same buttons as the feat choice above, for the same reason: it is a
 * question, and the chamber stays closed until it is answered.
 */
function BenefitChoice({
  benefits,
  value,
  accent,
  onPick,
}: {
  benefits: FeatBenefit[];
  value: string;
  accent: string;
  onPick: (name: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
        Elegis el beneficio de la dote
      </p>
      <div className="flex flex-wrap gap-1.5">
        {benefits.map((entry) => {
          const chosen = entry.name === value;

          return (
            <button
              key={entry.name}
              type="button"
              aria-pressed={chosen}
              title={entry.summary}
              onClick={() => onPick(chosen ? "" : entry.name)}
              className="border px-2.5 py-1 font-body text-[15px] transition-colors"
              style={
                chosen
                  ? { borderColor: accent, background: `${accent}1f`, color: accent }
                  : { borderColor: "rgba(74,70,64,0.7)", color: "#FFFFFF" }
              }
            >
              {entry.name}
            </button>
          );
        })}
      </div>
      {value ? (
        <p className={`mt-2 ${WHISPER}`}>{benefits.find((entry) => entry.name === value)?.summary}</p>
      ) : (
        <p className={`mt-2 ${WHISPER}`}>Elegi uno para seguir.</p>
      )}
    </div>
  );
}

/**
 * One row of grants.
 *
 * `chosen` tints the chips to say the player still has to pick; `muted` is for
 * the things that come along without mattering mechanically, like clothes.
 */
function Line({
  label,
  items,
  accent,
  chosen = false,
  muted = false,
}: {
  label: string;
  items: string[];
  accent: string;
  chosen?: boolean;
  muted?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="border px-2.5 py-1 font-body text-sm"
            style={
              chosen
                ? { borderColor: `${accent}55`, color: "#FFFFFF" }
                : muted
                  ? { borderColor: "rgba(74,70,64,0.4)", color: "rgba(230,223,206,0.6)" }
                  : { borderColor: `${accent}33`, background: `${accent}0f`, color: accent }
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
