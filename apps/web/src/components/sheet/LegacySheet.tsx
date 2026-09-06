/**
 * The 2014 sheet, the one everybody has a copy of.
 *
 * Three pages, in the arrangement the official PDF prints them and roll20's
 * legacy sheet keeps: the character on the first, who they are on the second,
 * and the spells on the third. Stacked rather than tabbed, because the window
 * scrolls and a page you have to find is a page you forget exists.
 *
 * The boxes a player fills in at the table — current hit points, temporary hit
 * points, experience, inspiration, death saves, spell slots expended — are
 * drawn empty, exactly as the printed sheet has them. This builder keeps no
 * play-time state, and a filled-in zero would be a claim.
 */

import type { SheetData } from "@/lib/sheet-data";
import { signed } from "@/lib/sheet-data";
import {
  AbilityBox,
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

export default function LegacySheet({ data }: { data: SheetData }) {
  const skills = data.abilities.flatMap((ability) => ability.skills);

  return (
    <div>
      <Paper>
        {/* ---------------- header ---------------- */}
        <header className="grid gap-3 md:grid-cols-[1.1fr_2fr]">
          <Box label="Nombre del personaje">
            <p className="py-1 text-lg font-bold leading-tight">{data.characterName || " "}</p>
          </Box>

          <div
            style={{ borderColor: INK }}
            className="grid grid-cols-2 gap-x-4 gap-y-1 border px-3 py-2 sm:grid-cols-3"
          >
            <HeaderField label="Clase y nivel" value={`${data.classLine}`} />
            <HeaderField label="Trasfondo" value={data.backgroundLabel} />
            <HeaderField label="Nombre del jugador" value={data.playerName} />
            <HeaderField label="Raza" value={data.speciesLabel} />
            <HeaderField label="Alineamiento" value={data.alignment} />
            <HeaderField label="Puntos de experiencia" value="" />
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* ---------------- column one ---------------- */}
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <div className="space-y-4">
              {data.abilities.map((ability) => (
                <AbilityBox
                  key={ability.id}
                  label={ABILITY_SHORT[ability.id] ?? ability.id}
                  modifier={signed(ability.modifier)}
                  score={ability.score}
                />
              ))}
            </div>

            <div className="space-y-3">
              <Blank label="Inspiracion" />
              <Box label="Bonificador de competencia">
                <p className="py-0.5 text-center text-sm font-bold">
                  {signed(data.proficiencyBonus)}
                </p>
              </Box>

              <Panel title="Tiradas de salvacion">
                <div className="space-y-0.5">
                  {data.abilities.map((ability) => (
                    <CheckRow
                      key={ability.id}
                      proficient={ability.save.proficient}
                      modifier={signed(ability.save.modifier)}
                      name={ability.label}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Pericias">
                <div className="space-y-0.5">
                  {skills.map((check) => (
                    <CheckRow
                      key={check.name}
                      proficient={check.proficient}
                      expert={check.expert}
                      modifier={signed(check.modifier)}
                      name={SKILL_LABEL[check.name] ?? check.name}
                      suffix={ABILITY_SHORT[check.ability] ?? check.ability}
                    />
                  ))}
                </div>
              </Panel>

              <Box label="Sabiduria pasiva (Percepcion)">
                <p className="py-0.5 text-center text-sm font-bold">{data.passivePerception}</p>
              </Box>

              {/* Columna izquierda, al pie: es donde la hoja impresa lo pone. */}
              <Panel title="Otras competencias e idiomas">
                <Lines
                  lines={[
                    ...data.weaponProficiencies,
                    ...data.toolProficiencies,
                    ...data.languages,
                  ]}
                />
              </Panel>
            </div>
          </div>

          {/* ---------------- column two ---------------- */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Vital label="Clase de armadura" value={String(data.armorClass)} />
              <Vital label="Iniciativa" value={signed(data.initiative)} />
              <Vital label="Velocidad" value={data.speed ? String(data.speed) : "—"} />
            </div>

            <Box>
              <Caption>Maximo de puntos de golpe: {data.hitPoints}</Caption>
              <p className="py-3 text-center text-2xl font-bold leading-none">&nbsp;</p>
              <Caption>Puntos de golpe actuales</Caption>
            </Box>

            <Blank label="Puntos de golpe temporales" />

            <div className="grid grid-cols-2 gap-2">
              <Box label="Dados de golpe">
                <Caption>
                  Total: {data.hitDie ? `${data.level}d${data.hitDie}` : "—"}
                </Caption>
                <p className="py-1.5 text-center text-sm">&nbsp;</p>
              </Box>
              <Box label="Salvaciones contra muerte">
                <div className="space-y-1 py-0.5">
                  <Bubbles label="Exitos" />
                  <Bubbles label="Fallos" />
                </div>
              </Box>
            </div>

            <Panel title="Ataques y lanzamiento de conjuros">
              <div className="grid grid-cols-[1fr_46px_1fr] gap-x-2 text-[8px] uppercase tracking-[0.1em] opacity-70">
                <span>Nombre</span>
                <span className="text-center">Bonif.</span>
                <span>Dano / tipo</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {data.attacks.length === 0 ? (
                  <p className="text-[11px] italic opacity-50">Sin armas en la mochila.</p>
                ) : (
                  data.attacks.map((attack) => (
                    <div
                      key={attack.name}
                      className="grid grid-cols-[1fr_46px_1fr] gap-x-2 text-[11px] leading-snug"
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
                    </div>
                  ))
                )}
              </div>

              {data.spellcasting && (
                <p className="mt-2 text-[10px] leading-snug opacity-80">
                  Conjuros: ataque {signed(data.spellcasting.attackBonus)} · CD de salvacion{" "}
                  {data.spellcasting.saveDC}
                </p>
              )}
            </Panel>

            <div className="grid grid-cols-[46px_1fr] gap-2">
              <div className="space-y-1">
                {(["pc", "pp", "pe", "po", "ppt"] as const).map((coin, index) => (
                  <div key={coin} style={{ borderColor: INK }} className="flex border text-[10px]">
                    <span className="w-6 shrink-0 border-r px-1 py-0.5 text-center uppercase" style={{ borderColor: INK }}>
                      {coin}
                    </span>
                    <span className="flex-1 px-1 py-0.5 text-right">
                      {[data.purse.cp, data.purse.sp, data.purse.ep, data.purse.gp, data.purse.pp][index] || ""}
                    </span>
                  </div>
                ))}
              </div>

              <Panel title="Equipo">
                <Lines
                  lines={data.equipment.map((entry) =>
                    entry.quantity > 1 ? `${entry.label} ×${entry.quantity}` : entry.label,
                  )}
                />
              </Panel>
            </div>
          </div>

          {/* ---------------- column three ---------------- */}
          <div className="space-y-3">
            <Panel title="Rasgos de personalidad" dashed>
              <p className="text-[11px] leading-snug">{data.personality.trait || "—"}</p>
            </Panel>
            <Panel title="Ideales" dashed>
              <p className="text-[11px] leading-snug">{data.personality.ideal || "—"}</p>
            </Panel>
            <Panel title="Vinculos" dashed>
              <p className="text-[11px] leading-snug">{data.personality.bond || "—"}</p>
            </Panel>
            <Panel title="Defectos" dashed>
              <p className="text-[11px] leading-snug">{data.personality.flaw || "—"}</p>
            </Panel>

            <Panel title="Rasgos y atributos">
              <Lines
                lines={[
                  ...data.classFeatures,
                  ...data.speciesTraits,
                  ...data.feats,
                  ...data.backgroundFeatures,
                ]}
              />
            </Panel>
          </div>
        </div>
      </Paper>

      <PageTwo data={data} />
      {data.spellcasting && <SpellPage data={data} />}
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate border-b text-[11px] leading-tight" style={{ borderColor: INK }}>
        {value || " "}
      </p>
      <p className="text-[8px] uppercase tracking-[0.12em] opacity-70">{label}</p>
    </div>
  );
}

function PageTwo({ data }: { data: SheetData }) {
  return (
    <Paper>
      <p className="mb-4 text-center text-[9px] uppercase tracking-[0.3em] opacity-60">Pagina 2</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Panel title="Apariencia">
            {data.appearance.length === 0 ? (
              <p className="text-[11px] italic opacity-50">—</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {data.appearance.map((field) => (
                  <div key={field.label} className="flex items-baseline gap-2 text-[11px]">
                    <span className="opacity-60">{field.label}</span>
                    <span className="font-bold">{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Aliados y organizaciones" dashed>
            <p className="text-[11px] italic opacity-50">—</p>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Historia del personaje" dashed>
            <p className="whitespace-pre-wrap text-[11px] leading-snug">{data.backstory || "—"}</p>
          </Panel>

          <Panel title="Tesoro" dashed>
            <p className="text-[11px] italic opacity-50">—</p>
          </Panel>
        </div>
      </div>
    </Paper>
  );
}

function SpellPage({ data }: { data: SheetData }) {
  const spellcasting = data.spellcasting;
  if (!spellcasting) return null;

  const slots = spellcasting.slots;

  return (
    <Paper>
      <p className="mb-4 text-center text-[9px] uppercase tracking-[0.3em] opacity-60">
        Conjuros
      </p>

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
          <Panel
            key={bucket.level}
            title={bucket.level === 0 ? "Trucos" : `Nivel ${bucket.level}`}
          >
            {bucket.level > 0 && (
              <div className="mb-1 flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] opacity-70">
                <span>Espacios: {slots[String(bucket.level)] ?? 0}</span>
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
                <div key={spell.label} className="flex items-center gap-1.5 text-[11px] leading-snug">
                  {bucket.level > 0 && (
                    <span
                      title={spell.prepared ? "Preparado" : "En el libro, sin preparar"}
                      style={{ borderColor: INK, background: spell.prepared ? INK : "transparent" }}
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
