/**
 * The 2024 sheet, the one that comes in the new Player's Handbook.
 *
 * It is not the 2014 sheet with new words on it, and the differences are the
 * point of drawing it separately: the skills sit under the ability they use
 * rather than in one alphabetical column, inspiration is Heroic Inspiration,
 * the attack table has a Notes column that carries weapon mastery, armour
 * training is a row of checkboxes, and attunement has three named slots.
 *
 * Play-time boxes are drawn empty here for the same reason as on the legacy
 * sheet: the builder holds choices, not a session.
 */

import type { SheetData } from "@/lib/sheet-data";
import { signed } from "@/lib/sheet-data";
import {
  Blank,
  Box,
  Bubbles,
  Caption,
  CheckRow,
  INK,
  Lines,
  Panel,
  Paper,
  Vital,
} from "./chrome";

const ABILITY_SHORT: Record<string, string> = {
  str: "FUE",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
};

const SKILL_LABEL: Record<string, string> = {
  acrobatics: "Acrobacias",
  "animal handling": "Trato con animales",
  arcana: "Arcanos",
  athletics: "Atletismo",
  deception: "Engano",
  history: "Historia",
  insight: "Perspicacia",
  intimidation: "Intimidacion",
  investigation: "Investigacion",
  medicine: "Medicina",
  nature: "Naturaleza",
  perception: "Percepcion",
  performance: "Interpretacion",
  persuasion: "Persuasion",
  religion: "Religion",
  "sleight of hand": "Juego de manos",
  stealth: "Sigilo",
  survival: "Supervivencia",
};

export default function ModernSheet({ data }: { data: SheetData }) {
  // Hoisted: the cantrip rows read it inside a callback, where a narrowed
  // property access does not survive.
  const spellcasting = data.spellcasting;

  return (
    <div>
      <Paper>
        {/* ---------------- header ---------------- */}
        <header className="grid gap-3 md:grid-cols-[1fr_1.6fr]">
          <Box label="Nombre del personaje">
            <p className="py-1 text-lg font-bold leading-tight">{data.characterName || " "}</p>
          </Box>

          <div
            style={{ borderColor: INK }}
            className="grid grid-cols-2 gap-x-4 gap-y-1 border px-3 py-2 sm:grid-cols-3"
          >
            <HeaderField label="Clase" value={data.classLine} />
            <HeaderField label="Subclase" value={data.subclassLabel} />
            <HeaderField label="Nivel" value={String(data.level)} />
            <HeaderField label="Especie" value={data.speciesLabel} />
            <HeaderField label="Trasfondo" value={data.backgroundLabel} />
            <HeaderField label="Nombre del jugador" value={data.playerName} />
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Box label="Bonificador de competencia">
            <p className="py-0.5 text-center text-sm font-bold">{signed(data.proficiencyBonus)}</p>
          </Box>
          <Blank label="Inspiracion heroica" />
          <Blank label="Puntos de experiencia" />
          <Box label="Alineamiento">
            <p className="py-0.5 text-center text-[11px]">{data.alignment || "—"}</p>
          </Box>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* ---------------- abilities, each with its own skills ---------------- */}
          <div className="space-y-3">
            {data.abilities.map((ability) => (
              <div key={ability.id} style={{ borderColor: INK }} className="border px-2 py-2">
                <div className="flex items-center gap-2">
                  <span
                    style={{ borderColor: INK }}
                    className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full border leading-none"
                  >
                    <span className="text-[11px] font-bold">{ability.score}</span>
                  </span>
                  <span className="text-lg font-bold leading-none">{signed(ability.modifier)}</span>
                  <span className="text-[9px] uppercase tracking-[0.12em] opacity-70">
                    {ability.label}
                  </span>
                </div>

                <div className="mt-1.5 space-y-0.5 border-t pt-1.5" style={{ borderColor: INK }}>
                  <CheckRow
                    proficient={ability.save.proficient}
                    modifier={signed(ability.save.modifier)}
                    name="Salvacion"
                  />
                  {ability.skills.map((check) => (
                    <CheckRow
                      key={check.name}
                      proficient={check.proficient}
                      expert={check.expert}
                      modifier={signed(check.modifier)}
                      name={SKILL_LABEL[check.name] ?? check.name}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ---------------- defences, hit points, attacks ---------------- */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Vital label="Clase de armadura" value={String(data.armorClass)} />
              <Vital label="Iniciativa" value={signed(data.initiative)} />
              <Vital label="Velocidad" value={data.speed ? String(data.speed) : "—"} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Box label="Tamano">
                <p className="py-0.5 text-center text-[11px]">{data.sizeLabel || "—"}</p>
              </Box>
              <Box label="Percepcion pasiva">
                <p className="py-0.5 text-center text-sm font-bold">{data.passivePerception}</p>
              </Box>
              <Box label="Vision en la oscuridad">
                <p className="py-0.5 text-center text-[11px]">
                  {data.darkvision ? `${data.darkvision} pies` : "—"}
                </p>
              </Box>
            </div>

            <Box>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="py-2 text-center text-2xl font-bold leading-none">&nbsp;</p>
                  <Caption>Puntos de golpe actuales</Caption>
                </div>
                <div>
                  <p className="py-2 text-center text-2xl font-bold leading-none">
                    {data.hitPoints}
                  </p>
                  <Caption>Maximo de puntos de golpe</Caption>
                </div>
              </div>
            </Box>

            <div className="grid grid-cols-2 gap-2">
              <Blank label="Puntos de golpe temporales" />
              <Box label="Dados de golpe">
                <Caption>
                  {data.hitDie ? `${data.level}d${data.hitDie}` : "—"} · gastados
                </Caption>
                <p className="py-1 text-center text-sm">&nbsp;</p>
              </Box>
            </div>

            <Box label="Salvaciones contra muerte">
              <div className="space-y-1 py-0.5">
                <Bubbles label="Exitos" />
                <Bubbles label="Fallos" />
              </div>
            </Box>

            <Panel title="Armas y trucos de dano">
              <div className="grid grid-cols-[1fr_40px_1fr_1fr] gap-x-2 text-[8px] uppercase tracking-[0.1em] opacity-70">
                <span>Nombre</span>
                <span className="text-center">Atq/CD</span>
                <span>Dano y tipo</span>
                <span>Notas</span>
              </div>

              <div className="mt-1 space-y-0.5">
                {data.attacks.map((attack) => (
                  <div
                    key={attack.name}
                    className="grid grid-cols-[1fr_40px_1fr_1fr] gap-x-2 text-[11px] leading-snug"
                  >
                    <span className="truncate">
                      {attack.name}
                      {attack.quantity > 1 ? ` ×${attack.quantity}` : ""}
                    </span>
                    <span className="text-center font-bold">{signed(attack.attackBonus)}</span>
                    <span className="truncate">
                      {attack.damage ?? "—"}
                      {attack.versatileDamage ? ` (${attack.versatileDamage})` : ""}
                      {attack.damageType ? ` ${attack.damageType}` : ""}
                    </span>
                    <span className="truncate" title={notesOf(attack)}>
                      {notesOf(attack) || "—"}
                    </span>
                  </div>
                ))}

                {spellcasting &&
                  data.spellsByLevel
                    .find((bucket) => bucket.level === 0)
                    ?.spells.map((spell) => (
                      <div
                        key={`truco-${spell.label}`}
                        className="grid grid-cols-[1fr_40px_1fr_1fr] gap-x-2 text-[11px] leading-snug"
                      >
                        <span className="truncate">{spell.label}</span>
                        <span className="text-center font-bold">
                          {signed(spellcasting.attackBonus)}
                        </span>
                        <span className="opacity-60">—</span>
                        <span className="truncate opacity-60">Truco</span>
                      </div>
                    ))}

                {data.attacks.length === 0 && !spellcasting && (
                  <p className="text-[11px] italic opacity-50">Sin armas en la mochila.</p>
                )}
              </div>
            </Panel>
          </div>

          {/* ---------------- what the character is ---------------- */}
          <div className="space-y-3">
            <Panel title="Rasgos de clase">
              <Lines lines={data.classFeatures} />
            </Panel>
            <Panel title="Rasgos de especie">
              <Lines lines={data.speciesTraits} />
            </Panel>
            <Panel title="Dotes">
              <Lines lines={[...data.feats, ...data.backgroundFeatures]} />
            </Panel>
          </div>
        </div>
      </Paper>

      <PageTwo data={data} />
      {data.spellcasting && <SpellPage data={data} />}
    </div>
  );
}

/** The Notes column: the properties, and a mastery only if the player has it. */
function notesOf(attack: SheetData["attacks"][number]): string {
  return [...(attack.mastery ? [`Maestria: ${attack.mastery}`] : []), ...attack.properties].join(
    ", ",
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate border-b text-[11px] leading-tight" style={{ borderColor: INK }}>
        {value || " "}
      </p>
      <p className="text-[8px] uppercase tracking-[0.12em] opacity-70">{label}</p>
    </div>
  );
}

function PageTwo({ data }: { data: SheetData }) {
  return (
    <Paper>
      <p className="mb-4 text-center text-[9px] uppercase tracking-[0.3em] opacity-60">Pagina 2</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <Panel title="Apariencia">
            {data.appearance.length === 0 ? (
              <p className="text-[11px] italic opacity-50">—</p>
            ) : (
              <div className="space-y-0.5">
                {data.appearance.map((field) => (
                  <div key={field.label} className="flex items-baseline gap-2 text-[11px]">
                    <span className="opacity-60">{field.label}</span>
                    <span className="font-bold">{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Historia y personalidad" dashed>
            <div className="space-y-1.5 text-[11px] leading-snug">
              <Trait label="Rasgo de personalidad" value={data.personality.trait} />
              <Trait label="Ideal" value={data.personality.ideal} />
              <Trait label="Vinculo" value={data.personality.bond} />
              <Trait label="Defecto" value={data.personality.flaw} />
              {data.backstory && <p className="whitespace-pre-wrap pt-1">{data.backstory}</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Entrenamiento con armaduras">
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["Ligera", data.armorTraining.light],
                  ["Media", data.armorTraining.medium],
                  ["Pesada", data.armorTraining.heavy],
                  ["Escudos", data.armorTraining.shields],
                ] as const
              ).map(([label, trained]) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    style={{ borderColor: INK, background: trained ? INK : "transparent" }}
                    className="inline-block h-2.5 w-2.5 shrink-0 border"
                  />
                  {label}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Armas y herramientas">
            <Lines lines={[...data.weaponProficiencies, ...data.toolProficiencies]} />
          </Panel>

          <Panel title="Idiomas">
            <Lines lines={data.languages} />
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Equipo">
            <Lines
              lines={data.equipment.map((entry) =>
                entry.quantity > 1 ? `${entry.label} ×${entry.quantity}` : entry.label,
              )}
            />
          </Panel>

          <Panel title="Monedas">
            <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
              {(
                [
                  ["PC", data.purse.cp],
                  ["PP", data.purse.sp],
                  ["PE", data.purse.ep],
                  ["PO", data.purse.gp],
                  ["PPT", data.purse.pp],
                ] as const
              ).map(([label, amount]) => (
                <div key={label}>
                  <p className="font-bold">{amount || "—"}</p>
                  <p className="text-[8px] uppercase tracking-[0.1em] opacity-70">{label}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Sintonizacion magica">
            <div className="space-y-1">
              {[0, 1, 2].map((slot) => (
                <div key={slot} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    style={{
                      borderColor: INK,
                      background: slot < data.attunedCount ? INK : "transparent",
                    }}
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
                  />
                  <span
                    style={{ borderColor: INK }}
                    className="flex-1 border-b leading-tight opacity-60"
                  >
                    &nbsp;
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Paper>
  );
}

function Trait({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}

function SpellPage({ data }: { data: SheetData }) {
  const spellcasting = data.spellcasting;
  if (!spellcasting) return null;

  return (
    <Paper>
      <p className="mb-4 text-center text-[9px] uppercase tracking-[0.3em] opacity-60">Conjuros</p>

      <div className="grid grid-cols-3 gap-2">
        <Box label="Aptitud magica">
          <p className="py-0.5 text-center text-sm font-bold uppercase">
            {ABILITY_SHORT[spellcasting.ability] ?? spellcasting.ability}
          </p>
        </Box>
        <Box label="CD de salvacion">
          <p className="py-0.5 text-center text-sm font-bold">{spellcasting.saveDC}</p>
        </Box>
        <Box label="Bonificador de ataque">
          <p className="py-0.5 text-center text-sm font-bold">{signed(spellcasting.attackBonus)}</p>
        </Box>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.spellsByLevel.map((bucket) => (
          <Panel key={bucket.level} title={bucket.level === 0 ? "Trucos" : `Nivel ${bucket.level}`}>
            {bucket.level > 0 && (
              <div className="mb-1 flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] opacity-70">
                <span>Espacios: {spellcasting.slots[String(bucket.level)] ?? 0}</span>
                <span
                  style={{ borderColor: INK }}
                  className="ml-auto min-w-[42px] border-b text-right"
                >
                  &nbsp;
                </span>
                <span>gastados</span>
              </div>
            )}

            <div className="space-y-0.5">
              {bucket.spells.map((spell) => (
                <div
                  key={spell.label}
                  className="flex items-center gap-1.5 text-[11px] leading-snug"
                >
                  {bucket.level > 0 && (
                    <span
                      title={spell.prepared ? "Preparado" : "En el libro, sin preparar"}
                      style={{
                        borderColor: INK,
                        background: spell.prepared ? INK : "transparent",
                      }}
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
                    />
                  )}
                  <span className="truncate">{spell.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}

        {spellcasting.pactLevel && (
          <Panel title="Magia de pacto">
            <p className="text-[11px] leading-snug">
              Espacios de nivel {spellcasting.pactLevel}, recuperados en descanso corto.
            </p>
          </Panel>
        )}
      </div>
    </Paper>
  );
}
