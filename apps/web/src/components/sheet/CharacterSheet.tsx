/**
 * The character sheet, in the arrangement every player already knows.
 *
 * The layout is the SRD's — the one roll20 draws, three columns: what the
 * character *is* on the left, what it *does* in the middle, who it *is* on the
 * right. That was chosen for a reason beyond familiarity: roll20's importer
 * moves characters as JSON, so building against this shape leaves the work
 * done for the day a character has to travel there. See `RUTA-POST-BETA.md`.
 *
 * Every number here is read off the derived build — the same object the Foundry
 * export sends — so the sheet and the export can never disagree. Nothing is
 * recomputed locally, and the two things this file does own are layout and
 * which of them a player looks at first.
 *
 * What the classic sheet has and this does not: experience points, inspiration
 * and death saves. All three are play-time state, and this builder does not
 * play. Drawing empty boxes for them would promise a tracker that is not here.
 */

import type { CharacterBuild } from "@bertinis-vault/contracts";

import Checks from "@/components/forge/Checks";
import type { BuilderState } from "@/lib/builder";
import { characterLevelFor, classesFor, classingLabelFor } from "@/lib/builder";
import { ABILITY_IDS, abilityLabels } from "@/lib/abilities";
import { entryById, hitDieFor } from "@/lib/catalog";
import { savingThrowChecksFor, skillChecksFor } from "@/lib/checks";
import { featIdsFor } from "@/lib/feats";
import { gearProficienciesFor } from "@/lib/gear-proficiencies";
import { featGearGrantsFor } from "@/lib/index-options";
import { attackLinesFor, signed } from "@/lib/sheet-attacks";
import { speciesProficienciesFor } from "@/lib/species";
import { coinLabel } from "@/lib/starting-kit";
import {
  initiativeFor,
  passivePerceptionFor,
  sensesFor,
  sizeLabelFor,
  speedFor,
} from "@/lib/table-numbers";
import { rulesVersionOf } from "@/lib/vault-store";
import { LABEL_MB2 } from "@/styles/recipes";

const ABILITY_SHORT: Record<string, string> = {
  str: "FUE",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

const modifierOf = (score: number) => Math.floor((score - 10) / 2);

export default function CharacterSheet({
  state,
  build,
  accent,
}: {
  state: BuilderState;
  /** The derived build. The sheet reads numbers, it does not compute them. */
  build: CharacterBuild;
  accent: string;
}) {
  const rulesVersion = rulesVersionOf(state);

  const race = entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
  const background = entryById(
    "background",
    rulesVersion,
    state.backgroundId,
    state.sourceBooks[`background:${state.backgroundId}`],
  );
  const classLine = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );

  const classEntries = state.classId ? classesFor(state) : [];
  const speciesGrant = state.raceId
    ? speciesProficienciesFor(state.raceId, state.subraceId, rulesVersion, state.sourceBooks)
    : null;
  const gearProficiencies = classEntries.length
    ? gearProficienciesFor(
        classEntries,
        rulesVersion,
        speciesGrant ? { id: state.raceId, ...speciesGrant } : null,
        featGearGrantsFor(featIdsFor(state), rulesVersion),
      )
    : null;

  const attacks = attackLinesFor(build, rulesVersion, gearProficiencies);
  const normalized = build.choices.normalized;
  const equipment = (normalized?.equipment ?? []).filter((entry) => entry.category !== "weapon");
  const features = normalized?.features ?? [];
  const spells = [...(normalized?.spells ?? [])].sort(
    (a, b) => a.level - b.level || a.label.localeCompare(b.label),
  );
  const languages = (normalized?.proficiencies ?? []).filter((entry) => entry.kind === "language");
  const tools = (normalized?.proficiencies ?? []).filter((entry) => entry.kind === "tool");

  const senses = sensesFor(state, rulesVersion);
  const speed = speedFor(state, rulesVersion);
  const size = sizeLabelFor(state, rulesVersion);
  const hitDie = state.classId ? hitDieFor(state.classId, rulesVersion) : null;
  const level = characterLevelFor(state);
  const coins = coinLabel(build.choices.startingCopper ?? 0);

  return (
    <div className="px-6 py-6 font-body text-bone md:px-8">
      {/* ---------- who this is ---------- */}
      <header className="border-b border-iron/40 pb-5">
        <p className="font-display text-3xl font-black leading-tight text-bone">
          {state.characterName || "Sin nombre"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Clase y nivel" value={classLine ? `${classLine}` : "—"} />
          <Field label="Trasfondo" value={background?.label ?? "—"} />
          <Field label="Especie" value={race?.label ?? "—"} />
          <Field label="Alineamiento" value={state.alignment || "—"} />
          <Field label="Tamano" value={size ?? "—"} />
          <Field label="Jugador" value={state.playerName || "—"} />
        </div>
      </header>

      <div className="grid gap-8 pt-6 lg:grid-cols-3">
        {/* ---------- column one: what it is ---------- */}
        <section>
          <p className={LABEL_MB2}>Puntuaciones</p>
          <div className="grid grid-cols-3 gap-2">
            {ABILITY_IDS.map((ability) => {
              const score = build.abilities.final[ability];
              return (
                <div
                  key={ability}
                  className="border border-iron/40 bg-ash/50 px-2 py-2 text-center"
                  style={{ borderColor: `${accent}33` }}
                >
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/60">
                    {ABILITY_SHORT[ability] ?? ability}
                  </p>
                  <p className="font-display text-2xl font-black leading-tight" style={{ color: accent }}>
                    {signed(modifierOf(score))}
                  </p>
                  <p className="font-mono text-[11px] text-bone/60" title={abilityLabels[ability]}>
                    {score}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Competencia" value={signed(build.derived.proficiencyBonus)} />
            <Stat label="Perc. pasiva" value={String(passivePerceptionFor(build))} />
          </div>

          <Checks saves={savingThrowChecksFor(build)} skills={skillChecksFor(build)} accent={accent} />

          <Block title="Otras competencias e idiomas">
            <Lines
              lines={[
                ...(gearProficiencies?.armor ?? []).map((line) => line.label),
                ...(gearProficiencies?.weapons ?? []).map((line) => line.label),
                ...tools.map((entry) => entry.label),
                ...languages.map((entry) => entry.label),
              ]}
              empty="Ninguna."
            />
          </Block>
        </section>

        {/* ---------- column two: what it does ---------- */}
        <section>
          <div className="grid grid-cols-3 gap-2">
            <Vital label="CA" value={String(build.derived.ac)} accent={accent} />
            <Vital label="Iniciativa" value={signed(initiativeFor(build))} accent={accent} />
            <Vital label="Velocidad" value={speed ? `${speed} pies` : "—"} accent={accent} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Vital label="Puntos de golpe" value={String(build.derived.hp)} accent={accent} />
            <Vital
              label="Dados de golpe"
              value={hitDie ? `${level}d${hitDie}` : "—"}
              accent={accent}
            />
          </div>

          {senses?.darkvision ? (
            <p className="mt-3 font-mono text-[11px] tracking-[0.15em] text-bone/60">
              Vision en la oscuridad {senses.darkvision} pies
            </p>
          ) : null}

          <Block title="Ataques">
            {attacks.length === 0 ? (
              <p className="font-body text-[13px] italic text-bone/60">
                Sin armas en la mochila.
              </p>
            ) : (
              <div className="space-y-2">
                {attacks.map((attack) => (
                  <div
                    key={attack.name}
                    className="flex items-baseline justify-between gap-3 border-b border-iron/25 pb-1.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-body text-[14px] text-bone">
                        {attack.name}
                        {attack.quantity > 1 && (
                          <span className="text-bone/60"> ×{attack.quantity}</span>
                        )}
                      </span>
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-bone/60">
                        {attack.ranged ? "distancia" : "cuerpo a cuerpo"}
                        {attack.finesse ? " · sutil" : ""}
                        {attack.proficient ? "" : " · sin competencia"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-mono text-sm" style={{ color: accent }}>
                        {signed(attack.attackBonus)}
                      </span>
                      <span className="ml-3 font-mono text-[12px] text-bone/75">
                        {attack.damage ?? "—"}
                        {attack.versatileDamage ? ` (${attack.versatileDamage})` : ""}
                        {attack.damageType ? ` ${attack.damageType}` : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Block>

          <Block title="Equipo">
            <Lines
              lines={equipment.map((entry) =>
                entry.quantity > 1 ? `${entry.label} ×${entry.quantity}` : entry.label,
              )}
              empty="La mochila esta vacia."
            />
            {coins && (
              <p className="mt-2 font-mono text-[12px] tracking-[0.15em]" style={{ color: accent }}>
                {coins}
              </p>
            )}
          </Block>
        </section>

        {/* ---------- column three: who it is ---------- */}
        <section>
          {build.derived.spellcasting && (
            <Block title="Conjuros" first>
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2">
                <Stat
                  label="Aptitud"
                  value={ABILITY_SHORT[build.derived.spellcasting.ability] ?? build.derived.spellcasting.ability}
                />
                <Stat label="CD de salvacion" value={String(build.derived.spellcasting.saveDC)} />
                <Stat label="Ataque" value={signed(build.derived.spellcasting.attackBonus)} />
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(build.derived.spellcasting.slots)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([slotLevel, count]) => (
                    <span
                      key={slotLevel}
                      className="border px-2 py-0.5 font-mono text-[11px]"
                      style={{ borderColor: `${accent}55`, color: accent }}
                    >
                      Nv {slotLevel} · {count}
                    </span>
                  ))}
                {build.derived.spellcasting.pactLevel && (
                  <span
                    className="border px-2 py-0.5 font-mono text-[11px]"
                    style={{ borderColor: `${accent}55`, color: accent }}
                    title="Espacios de pacto: se recuperan en descanso corto"
                  >
                    Pacto · Nv {build.derived.spellcasting.pactLevel}
                  </span>
                )}
              </div>

              <Lines
                lines={spells.map((entry) =>
                  entry.level === 0 ? `${entry.label} (truco)` : `${entry.label} (nv ${entry.level})`,
                )}
                empty="Sin conjuros."
              />
            </Block>
          )}

          <Block title="Rasgos" first={!build.derived.spellcasting}>
            <Lines lines={features.map((entry) => entry.label)} empty="Sin rasgos listados." />
          </Block>

          {(state.trait || state.ideal || state.bond || state.flaw) && (
            <Block title="Personalidad">
              <div className="space-y-2">
                {(
                  [
                    ["Rasgo", state.trait],
                    ["Ideal", state.ideal],
                    ["Vinculo", state.bond],
                    ["Defecto", state.flaw],
                  ] as const
                ).map(([label, value]) =>
                  value ? (
                    <div key={label}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone/60">
                        {label}
                      </p>
                      <p className="font-body text-[13px] leading-snug text-bone/75">{value}</p>
                    </div>
                  ) : null,
                )}
              </div>
            </Block>
          )}

          {state.notes && (
            <Block title="Notas">
              <Lines lines={state.notes.split("\n").filter((line) => line.trim())} empty="" />
            </Block>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-bone/60">{label}</p>
      <p className="truncate font-body text-[14px] text-bone" title={value}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-bone/60">{label}</p>
      <p className="font-mono text-sm text-bone">{value}</p>
    </div>
  );
}

function Vital({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="border bg-ash/50 px-2 py-3 text-center"
      style={{ borderColor: `${accent}33` }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/60">{label}</p>
      <p className="mt-0.5 font-display text-xl font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function Block({
  title,
  first,
  children,
}: {
  title: string;
  /** The first block in a column has nothing above it to be divided from. */
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={first ? "" : "mt-6 border-t border-iron/40 pt-5"}>
      <p className={LABEL_MB2}>{title}</p>
      {children}
    </div>
  );
}

function Lines({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) {
    return empty ? <p className="font-body text-[13px] italic text-bone/60">{empty}</p> : null;
  }

  return (
    <ul className="space-y-1">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`} className="font-body text-[13px] leading-snug text-bone/75">
          {line}
        </li>
      ))}
    </ul>
  );
}
