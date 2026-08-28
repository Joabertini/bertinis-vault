/**
 * The Living Record.
 *
 * The panel that watches the anvil. Everything on it is derived from the
 * canonical build, never from the raw draft: the scores shown are `final`
 * (base plus species bonus plus improvements plus half-feats), and the hit
 * points, armour class and save DC are the same numbers the export writes.
 *
 * Until the draft has a species, a class and a background it cannot be derived
 * at all, so the vitals show dashes rather than a stand-in. The seal reports
 * whether this draft can actually leave the Vault, and says what is missing
 * when it cannot.
 */

import { motion } from "framer-motion";

import type { ResolvedDraft } from "@/lib/derive";
import type { BuilderState } from "@/lib/builder";
import { characterLevelFor, classesFor, classingLabelFor } from "@/lib/builder";
import Checks from "@/components/forge/Checks";
import GearProficienciesPanel from "@/components/forge/GearProficiencies";
import { savingThrowChecksFor, skillChecksFor } from "@/lib/checks";
import { gearProficienciesFor } from "@/lib/gear-proficiencies";
import { grantedSpellsFor } from "@/lib/granted-spells";
import { speciesProficienciesFor, speciesTraitsFor } from "@/lib/species";
import { coinLabel } from "@/lib/starting-kit";
import { ABILITY_IDS, abilityLabels } from "@/lib/abilities";
import { entryById, hitDieFor } from "@/lib/catalog";
import { counselFor, type Advice } from "@/lib/counsel";
import { abilitySources, bonusOrigin } from "@/lib/improvements";
import {
  initiativeFor,
  passivePerceptionFor,
  sensesFor,
  sizeLabelFor,
  speedFor,
} from "@/lib/table-numbers";
import { actionProfile, concentrationAmong } from "@/lib/spells";
import { rulesVersionOf } from "@/lib/vault-store";
import Sigil from "@/components/sigils/Sigil";
import { HEADING, LABEL_MB2 } from "@/styles/recipes";

/** The highest score the sheet draws a full bar for. */
const BAR_CEILING = 20;

const MOVEMENT_LABEL: Record<string, string> = {
  burrow: "Excavas",
  climb: "Trepas",
  fly: "Volas",
  swim: "Nadas",
};

/** Non-empty lines, the way the builder stores its text lists. */
function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function LiveSheet({
  state,
  resolved,
  accent,
}: {
  state: BuilderState;
  resolved: ResolvedDraft;
  accent: string;
}) {
  const rulesVersion = rulesVersionOf(state);
  const race = entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
  const subrace = entryById("subrace", rulesVersion, state.subraceId, state.sourceBooks[`subrace:${state.subraceId}`]);
  const cls = entryById("class", rulesVersion, state.classId);
  // "Guerrero 5 / Mago 3" when there is more than one class, and just the
  // class's name when there is not.
  const classLine = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );

  const hitDie = state.classId ? hitDieFor(state.classId, rulesVersion) : null;

  // Armour and weapons, from the class alone. Deliberately not waiting for the
  // draft to derive: a player choosing between a rapier and a greatsword is
  // choosing before they have a background, and this is the answer.
  const classEntries = state.classId ? classesFor(state) : [];
  // The species grants weapons no class does — the dwarf's warhammer, the high
  // elf's longbow — and a dwarf wizard's only reason to swing one.
  const speciesGrant = state.raceId
    ? speciesProficienciesFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
    : null;
  const gearProficiencies = classEntries.length
    ? gearProficienciesFor(
        classEntries,
        rulesVersion,
        speciesGrant ? { id: state.raceId, ...speciesGrant } : null,
      )
    : null;
  const grantedSpells = grantedSpellsFor(state, rulesVersion);
  const speciesTraits = state.raceId
    ? speciesTraitsFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
    : [];
  const classLabels = Object.fromEntries([
    ...classEntries.map((entry) => [
      entry.classId,
      entryById("class", rulesVersion, entry.classId)?.label ?? entry.classId,
    ]),
    // The species is credited beside the classes, under the name the player
    // picked it by.
    ...(state.raceId ? [[state.raceId, race?.label ?? state.raceId]] : []),
  ]);
  const subclass = entryById("subclass", rulesVersion, state.subclassId, state.sourceBooks[`subclass:${state.subclassId}`]);
  const background = entryById(
    "background",
    rulesVersion,
    state.backgroundId,
    state.sourceBooks[`background:${state.backgroundId}`],
  );

  const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

  const ready = resolved.status === "ready";
  const derived = ready ? resolved.snapshot.derived : null;
  const snapshot = ready ? resolved.snapshot : null;
  // Off the race row, so it stands even before the draft is derivable — a
  // player who has picked an elf and nothing else can still read 30.
  const speed = speedFor(state, rulesVersion);
  const size = sizeLabelFor(state, rulesVersion);
  const senses = sensesFor(state, rulesVersion);

  /**
   * Raw scores while unforged, final scores once derivable.
   *
   * The draft's own `str`..`cha` are what the Attributes chamber binds, so
   * they can be shown before anything else is chosen — they just carry no
   * species bonus yet.
   */
  /*
   * What made each score, in four parts.
   *
   * Derived from the draft rather than from the snapshot, so it is right
   * before the draft is: a dwarf's +2 Constitution shows the moment the
   * species is picked, without waiting for a class and a background to be
   * chosen. That wait was the whole complaint — the bonus was being applied
   * correctly and just could not be seen from the chamber where the scores
   * are assigned.
   *
   * The snapshot runs the same arithmetic on the same inputs, so once the
   * draft does derive, `final` here and `abilities.final` there agree.
   */
  const sources = abilitySources(state);
  const scores = ABILITY_IDS.reduce(
    (all, ability) => ({ ...all, [ability]: sources[ability].final }),
    {} as Record<(typeof ABILITY_IDS)[number], number>,
  );

  const sealed = ready && resolved.missing.length === 0 && resolved.payload !== null;
  const problems = ready ? resolved.problems : [];

  /*
   * Whether the character works, as distinct from whether it is legal.
   *
   * Only once the draft derives: advice computed from placeholder scores would
   * scold a player for a Constitution they have not assigned yet.
   */
  const spellLines = [...toLines(state.spellsText), ...toLines(state.cantripsText)];
  const concentration = concentrationAmong(spellLines, rulesVersion);
  const actions = spellLines.length > 0 ? actionProfile(spellLines, rulesVersion) : null;
  const counsel = ready
    ? counselFor(resolved.snapshot, state, rulesVersion, concentration, actions)
    : [];

  return (
    <motion.aside
      layout
      className="sticky top-10 self-start border p-7 backdrop-blur-md"
      style={{
        borderColor: `${accent}44`,
        background: "linear-gradient(170deg, rgba(18,16,13,0.92), rgba(10,8,6,0.95))",
      }}
    >
      {/* ---- identity ---- */}
      <div className="flex items-start justify-between gap-4 border-b border-iron/50 pb-5">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.5em] uppercase text-bone/30">
            Living Record
          </p>
          <h3 className="mt-2 truncate font-display text-xl font-black text-bone">
            {state.characterName.trim() || "El Innombrado"}
          </h3>
          <p className="mt-1 font-body text-sm italic leading-snug text-bone/45">
            Nivel {characterLevelFor(state)} · {race?.label ?? "sin linaje"}
            {subrace ? ` (${stripParent(subrace.label, race?.label)})` : ""}
            {cls ? ` · ${classLine}` : ""}
          </p>
          {subclass && (
            <p className="mt-0.5 font-body text-xs italic text-bone/40">{subclass.label}</p>
          )}
          {background && (
            <p className="mt-0.5 font-body text-xs italic text-bone/30">{background.label}</p>
          )}
        </div>
        <Sigil name={state.classId || state.raceId || "fighter"} size={36} className="shrink-0" />
      </div>

      {/* ---- the three numbers that decide a fight ---- */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Vital
          label="PG"
          value={derived?.hp ?? "—"}
          accent={accent}
          dim={!ready}
          hint="Puntos de golpe: el dano que aguantas antes de caer."
        />
        <Vital
          label="CA"
          value={derived?.ac ?? "—"}
          accent={accent}
          dim={!ready}
          hint="Clase de armadura: la representacion numerica de lo protegido que estas."
        />
        <Vital
          label="Comp"
          value={derived ? `+${derived.proficiencyBonus}` : "—"}
          accent={accent}
          dim={!ready}
          hint="Bonificador de competencia: se suma a lo que sabes hacer. Sube con el nivel."
        />
        {/* The three a session asks for out loud, and that Foundry used to be
            the only place to find. */}
        <Vital
          label="Inic"
          value={snapshot ? signed(initiativeFor(snapshot)) : "—"}
          accent={accent}
          dim={!ready}
          hint="Iniciativa: se suma a tu tirada para ver quien actua primero."
        />
        <Vital
          label="Perc pas"
          value={snapshot ? passivePerceptionFor(snapshot) : "—"}
          accent={accent}
          dim={!ready}
          hint="Percepcion pasiva: lo que notas sin buscar. El DM tira contra esto."
        />
        <Vital
          label="Vel"
          value={speed !== null ? `${speed}` : "—"}
          accent={accent}
          dim={speed === null}
          hint="Velocidad en pies: cuanto te moves en tu turno."
        />
        {/* Vision in the dark, when there is any. Not decoration either: it
            decides whether the party lights a torch, and a torch decides
            whether anything in the dungeon can see the party. */}
        {senses?.darkvision !== null && senses !== null && (
          <Vital
            label="V. oscura"
            value={`${senses.darkvision}`}
            accent={accent}
            hint="Vision en la oscuridad, en pies. Ves con poca luz como si fuera clara, y a oscuras como con poca luz — en blanco y negro."
          />
        )}
        {/* Not decoration: size sets the square you occupy, what you can
            squeeze through, and in 2024 whether a Heavy weapon costs you
            disadvantage. */}
        <Vital
          label="Tam"
          value={size ?? "—"}
          accent={accent}
          dim={size === null}
          hint="Tamano: la casilla que ocupas y por donde pasas."
        />
      </div>

      {/* Flying, swimming, climbing, burrowing — the reason someone picked
          this species. An Aarakocra's 50 feet of flight was nowhere on the
          sheet. */}
      {senses?.otherSpeeds.length ? (
        <p className="mt-3 font-body text-xs italic leading-relaxed text-bone/40">
          {senses.otherSpeeds.map((entry, index) => (
            <span key={entry.mode}>
              {index > 0 && ", "}
              {MOVEMENT_LABEL[entry.mode]} <span style={{ color: accent }}>{entry.feet}</span> pies
            </span>
          ))}
          .
        </p>
      ) : null}

      {/* The purse, once there is one. A player who took the money instead of
          the gear has nothing else on the sheet to show for that choice. */}
      {snapshot?.choices.startingCopper ? (
        <p className="mt-4 font-body text-xs italic leading-relaxed text-bone/40">
          Empezas con{" "}
          <span style={{ color: accent }}>{coinLabel(snapshot.choices.startingCopper)}</span>.
        </p>
      ) : null}

      {/* What the character rolls, for everything. Only once the draft
          derives: a modifier without a proficiency bonus behind it would be
          a number the player could write down and be wrong about. */}
      {snapshot && (
        <Checks
          saves={savingThrowChecksFor(snapshot)}
          skills={skillChecksFor(snapshot)}
          accent={accent}
        />
      )}

      {/* What the character may wear and swing. Until now the only place this
          existed was inside the Foundry exporter, so a player who never
          exported never learned it. */}
      {gearProficiencies && (
        <GearProficienciesPanel
          proficiencies={gearProficiencies}
          classLabels={classLabels}
          accent={accent}
        />
      )}

      {/* What the species can do, by name. It is why someone picked a dwarf
          over a halfling, and it was the one thing about the choice the sheet
          never showed. */}
      {speciesTraits.length > 0 && (
        <div className="mt-6 border-t border-iron/40 pt-5">
          <p className={LABEL_MB2}>Rasgos de especie</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {speciesTraits.map((trait) => (
              <li key={trait} className="flex items-baseline gap-1.5">
                <span className="font-mono text-[9px] leading-none" style={{ color: accent }}>
                  •
                </span>
                <span className="truncate font-body text-xs">{trait}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        Spells nobody typed: a tiefling's Thaumaturgy, a drow's Faerie Fire.
        They reach the sheet whether or not the character casts anything, so a
        fighter who never opens the spell chamber still has to be told they
        have them — and told what handed them over, because a spell with no
        visible cause reads as a bug.
      */}
      {grantedSpells.length > 0 && (
        <div className="mt-6 border-t border-iron/40 pt-5">
          <p className={LABEL_MB2}>Conjuros que ya tenes</p>
          <ul className="space-y-1">
            {grantedSpells.map((granted) => (
              <li key={`${granted.grantedBy}:${granted.label}`} className="flex items-baseline gap-1.5">
                <span className="font-mono text-[9px] leading-none" style={{ color: accent }}>
                  •
                </span>
                <span className="font-body text-xs capitalize">{granted.label}</span>
                <span className="font-body text-[10px] italic text-bone/35">
                  {granted.uses
                    ? `${granted.grantedBy} · ${granted.uses.max}/${periodLabel(granted.uses.period)}`
                    : granted.grantedBy}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        The hit die, from the moment a class is picked.
        It is the one number that explains where the hit points came from, and
        it is knowable before the draft derives — a barbarian is a d12 whether
        or not a background has been chosen yet.
      */}
      {hitDie && (
        <p className="mt-2.5 font-body text-xs italic leading-relaxed text-bone/40">
          Dado de golpe <span style={{ color: accent }}>d{hitDie}</span>. A nivel 1 tenes {hitDie}{" "}
          puntos de golpe mas tu modificador de Constitucion, y por cada nivel volves a tirarlo.
        </p>
      )}

      {derived?.spellcasting && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Vital label="CD salv" value={derived.spellcasting.saveDC} accent={accent} />
          <Vital
            label="At. conjuro"
            value={`${derived.spellcasting.attackBonus >= 0 ? "+" : ""}${derived.spellcasting.attackBonus}`}
            accent={accent}
          />
        </div>
      )}

      {/* ---- abilities ---- */}
      <div className="mt-6 space-y-2.5">
        {ABILITY_IDS.map((ability) => {
          const source = sources[ability];
          const score = scores[ability];
          const modifier = Math.floor((score - 10) / 2);
          const added = source.species + source.improvements + source.feats;

          return (
            <div key={ability}>
              <div className="flex items-center justify-between gap-3">
                <span
                  className="font-mono text-[10px] tracking-[0.3em] text-bone/40"
                  title={abilityLabels[ability]}
                >
                  {ability.toUpperCase()}
                </span>
                <div className="flex items-center gap-3">
                  <div className="h-px w-14 bg-iron/60">
                    <motion.div
                      className="h-px"
                      animate={{ width: `${Math.min(score / BAR_CEILING, 1) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      style={{ background: accent }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[9px] text-ember/70">
                    {added > 0 ? `+${added}` : ""}
                  </span>
                  <span
                    className="w-6 text-right font-display text-sm font-bold"
                    style={{ color: accent }}
                  >
                    {score}
                  </span>
                  <span className="w-7 text-right font-mono text-[10px] text-bone/35">
                    {modifier >= 0 ? `+${modifier}` : modifier}
                  </span>
                </div>
              </div>

              {/*
                Where the points came from, spelled out under the score.
                A "+3" on its own does not tell a player whether they can still
                move it — a species bonus is fixed, an improvement is theirs to
                spend elsewhere, and a half-feat's +1 comes with the feat.
                Only drawn where something was actually added, so a character
                with no bonuses keeps the tight six-row list it had.
              */}
              {added > 0 && (
                <p className="mt-1 pl-1 font-mono text-[9px] leading-none text-bone/30">
                  {source.base} base
                  {source.species > 0 && ` · +${source.species} ${bonusOrigin(rulesVersion)}`}
                  {source.improvements > 0 && ` · +${source.improvements} mejora`}
                  {source.feats > 0 && ` · +${source.feats} dote`}
                  {source.capped && <span className="text-ember/70"> · tope 20</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- the seal ---- */}
      <motion.div
        key={sealed ? "sealed" : `open-${resolved.missing.length}`}
        initial={{ scale: 1.6, opacity: 0, rotate: -18 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 20 }}
        className="mt-7 inline-flex items-center gap-2 border px-3 py-1.5"
        style={{
          borderColor: sealed ? "rgba(110,15,15,0.6)" : "rgba(74,70,64,0.6)",
          background: sealed ? "rgba(110,15,15,0.2)" : "transparent",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: sealed ? "#FF5A1F" : "#4A4640" }}
        />
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-bone/70">
          {sealed ? "Sellado" : "Sin sellar"}
        </span>
      </motion.div>

      {/* What the seal is waiting on. Named, not implied by a disabled button. */}
      {resolved.missing.length > 0 && (
        <p className="mt-3 font-body text-xs italic leading-relaxed text-bone/35">
          Falta: {resolved.missing.join(", ")}.
        </p>
      )}

      {/* Whether it works, under whether it is legal. */}
      {counsel.length > 0 && <Counsel advice={counsel} accent={accent} />}

      {/* A pick the index could not resolve would be dropped on export. */}
      {problems.length > 0 && (
        <div className="mt-3 border-l-2 border-ember/60 pl-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ember/80">
            {problems.length} sin resolver
          </p>
          <ul className="mt-1.5 space-y-1">
            {problems.slice(0, 3).map((problem) => (
              <li key={problem} className="font-body text-xs italic leading-snug text-bone/35">
                {problem}
              </li>
            ))}
            {problems.length > 3 && (
              <li className="font-mono text-[9px] text-bone/25">y {problems.length - 3} mas</li>
            )}
          </ul>
        </div>
      )}
    </motion.aside>
  );
}

function Vital({
  label,
  value,
  accent,
  dim = false,
  hint,
}: {
  label: string;
  value: number | string;
  accent: string;
  dim?: boolean;
  /** Plain definition, for the abbreviations a new player has not met yet. */
  hint?: string;
}) {
  return (
    <div className="border border-iron/50 bg-void/40 px-2 py-2 text-center" title={hint}>
      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-bone/35">{label}</p>
      <p
        className="mt-0.5 font-display text-lg font-black"
        style={{ color: dim ? "#4A4640" : accent }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The counsel panel.
 *
 * Numbers first, because a player checking their attack bonus mid-build should
 * not have to read past a warning to find it. Build smells after, in the ember
 * the rest of this front already uses for "this will cost you something".
 */
function Counsel({ advice, accent }: { advice: Advice[]; accent: string }) {
  const numbers = advice.filter((entry) => entry.kind === "number");
  const rest = advice.filter((entry) => entry.kind !== "number");

  return (
    <div className="mt-6 border-t border-iron/40 pt-5">
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.35em] text-bone/40">
        Como pelea
      </p>

      <div className="space-y-3">
        {numbers.map((entry) => (
          <div key={entry.id}>
            <p className={HEADING} style={{ color: accent }}>
              {entry.title}
            </p>
            <p className="mt-0.5 font-body text-xs leading-relaxed text-bone/40">{entry.detail}</p>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-5 space-y-3">
          {rest.map((entry) => (
            <div
              key={entry.id}
              className="border-l-2 pl-3"
              style={{
                borderColor: entry.kind === "smell" ? "rgba(200,80,40,0.6)" : "rgba(176,138,62,0.5)",
              }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: entry.kind === "smell" ? "#C85028" : "#B08A3E" }}
              >
                {entry.title}
              </p>
              <p className="mt-1 font-body text-xs leading-relaxed text-bone/40">{entry.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Dwarf (Hill)" reads as "Hill" once the species is already on the line. */
function stripParent(label: string, parent?: string): string {
  if (!parent) return label;
  const prefix = `${parent} (`;
  return label.startsWith(prefix) ? label.slice(prefix.length).replace(/\)$/, "") : label;
}

/** dnd5e's recovery periods, as a player reads them. */
function periodLabel(period: string): string {
  return period === "lr" ? "descanso largo" : period === "sr" ? "descanso corto" : "dia";
}
