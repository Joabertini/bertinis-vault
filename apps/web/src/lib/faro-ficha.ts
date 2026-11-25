/**
 * The sheet as Faro del Alba's Discord plate reads it.
 *
 * The Forge is the only place that can compute a character's sheet, so it hands the compact result to the profile,
 * which stores it with the account. A character that was never in a world can then be shown in Discord.
 */
import { resolveDraft } from "@/lib/derive";
import { hojaDataFor, type HojaData, type HojaRules } from "@/lib/hoja-2024";
import { rulesVersionOf, type SealedCharacter } from "@/lib/vault-store";

export type Vista = {
  nombre: string;
  sistema: "dnd5e" | "pf2e" | "otro";
  mundo: string;
  clase: string;
  claseNombre: string;
  nivel: number | null;
  ascendencia: string;
  trasfondo: string;
  alineamiento: string;
  pv: { valor: number | null; max: number | null; temp: number | null } | null;
  ca: number | null;
  iniciativa: number | null;
  velocidad: string;
  competencia: number | null;
  percepcion: number | null;
  atributos: { clave: string; valor: number | null; mod: number | null; salva: number | null; competente: boolean }[];
  salvacionesPf2e: { nombre: string; valor: number | null; rango: number }[];
  habilidades: { nombre: string; total: number | null; rango: number; atributo: string }[];
  ataques: { nombre: string; bono: string; danio: string; extra: string }[];
  rasgos: { nombre: string; origen: string; detalle: string }[];
  equipado: { nombre: string; detalle: string }[];
  mochila: { nombre: string; cantidad: number | null }[];
  monedas: [string, number][];
  apariencia: [string, string][];
  personalidad: [string, string][];
  biografia: string;
  competencias: [string, string][];
  sinFicha: boolean;
};

export type FichaFaro = {
  id: string;
  version: string;
  nombre: string;
  clase: string;
  nivel: number | null;
  retrato: string | null;
  vista: Vista;
};

const ORDEN = ["str", "dex", "con", "int", "wis", "cha"] as const;
const HABILIDADES: Record<string, string> = {
  acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics", dec: "Deception", his: "History",
  ins: "Insight", itm: "Intimidation", inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception",
  prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand", ste: "Stealth", sur: "Survival",
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const plain = (html: string, max: number) =>
  html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
const pairs = (rows: [string, string][], max: number): [string, string][] =>
  rows.map(([key, value]) => [key, plain(value, max)] as [string, string]).filter(([, value]) => value);

/** The computed sheet, reduced to what the plate prints. Pure. */
export function vistaDeHoja(data: HojaData): Vista {
  const classes = data.classes ?? [];
  const subclasses = classes.map((entry) => entry.subclass).filter(Boolean);
  const classLine = classes.length ? classes.map((entry) => `${entry.name} ${entry.level}`).join(" / ") : data.classLine;
  const items = data.items ?? [];
  const wornGroup = (group: string) => group === "weapon" || group === "equipment";
  const worn = items.filter((item) => item.equipped && wornGroup(item.group));
  const bag = items.filter((item) => !worn.includes(item));

  return {
    nombre: data.name,
    sistema: "dnd5e",
    mundo: "",
    clase: [classLine, subclasses.join(" / ")].filter(Boolean).join(" · ") || "Adventurer",
    claseNombre: classes.map((entry) => entry.name).join(" / ") || "Adventurer",
    nivel: data.level ?? null,
    ascendencia: data.species ?? "",
    trasfondo: data.background ?? "",
    alineamiento: data.alignment ?? "",
    pv: { valor: data.hitPoints, max: data.hitPoints, temp: 0 },
    ca: data.armorClass,
    iniciativa: data.initiative,
    velocidad: data.speed === null || data.speed === undefined ? "—" : `${data.speed} ft.`,
    competencia: data.proficiencyBonus,
    percepcion: 10 + (data.skills.prc?.modifier ?? 0),
    atributos: ORDEN.map((key) => ({
      clave: key.toUpperCase(),
      valor: data.abilities[key].score,
      mod: data.abilities[key].modifier,
      salva: data.abilities[key].save.modifier,
      competente: data.abilities[key].save.proficient,
    })),
    salvacionesPf2e: [],
    habilidades: Object.entries(HABILIDADES)
      .filter(([key]) => data.skills[key])
      .map(([key, nombre]) => ({
        nombre,
        total: data.skills[key].modifier,
        rango: data.skills[key].expert ? 2 : data.skills[key].proficient ? 1 : 0,
        atributo: data.skills[key].ability.toUpperCase(),
      })),
    ataques: items
      .filter((item) => item.attack)
      .map((item) => ({
        nombre: item.name,
        bono: signed(item.attack!.bonus),
        danio: [item.attack!.damage, item.attack!.damageType].filter(Boolean).join(" "),
        extra: "",
      })),
    rasgos: [
      ...data.classFeatures.map((nombre) => ({ nombre, origen: "Class", detalle: "" })),
      ...data.speciesTraits.map((nombre) => ({ nombre, origen: "Species", detalle: "" })),
      ...data.backgroundFeatures.map((nombre) => ({ nombre, origen: "Background", detalle: "" })),
      ...data.feats.map((nombre) => ({ nombre, origen: "Feat", detalle: "" })),
    ],
    equipado: worn.map((item) => ({ nombre: item.name, detalle: item.armor ? `AC ${item.armor.ac}` : item.subtitle })),
    mochila: bag.map((item) => ({ nombre: item.name, cantidad: item.quantity })),
    monedas: (["pp", "gp", "ep", "sp", "cp"] as const).map((key) => [key.toUpperCase(), data.purse[key] ?? 0] as [string, number]),
    apariencia: pairs(data.characteristics.map((row) => [row.label, row.value] as [string, string]), 40),
    personalidad: pairs(
      [["Trait", data.personality.trait], ["Ideal", data.personality.ideal], ["Bond", data.personality.bond], ["Flaw", data.personality.flaw]],
      200,
    ),
    biografia: plain(data.biography ?? "", 900),
    competencias: (
      [
        ["Languages", data.languages.join(", ")],
        ["Weapons", data.weapons.join(", ")],
        ["Armor", data.armor.join(", ")],
        ["Tools", data.tools.map((tool) => tool.label).join(", ")],
      ] as [string, string][]
    ).filter(([, value]) => value),
    sinFicha: false,
  };
}

/** Only a picture the plate's Worker may fetch: https, and short. */
export const portraitUrl = (value: string | undefined): string | null =>
  value && /^https:\/\/[^\s]{1,400}$/.test(value) ? value : null;

/** The plate for one sealed character, or null when it does not derive (an old tome missing a pick). */
export function fichaDe(entry: SealedCharacter, rules: HojaRules): FichaFaro | null {
  const resolved = resolveDraft(entry.state);
  if (resolved.status !== "ready") return null;
  const data = hojaDataFor(entry.state, resolved.snapshot, rulesVersionOf(entry.state), rules);
  const vista = vistaDeHoja(data);
  return {
    id: entry.id,
    version: entry.sealedAt,
    nombre: data.name.slice(0, 100),
    clase: vista.claseNombre.slice(0, 100),
    nivel: vista.nivel,
    retrato: portraitUrl(data.portrait),
    vista,
  };
}

const tick = () => new Promise<void>((done) => setTimeout(done, 0));

/**
 * The plates the account does not have yet: those whose version differs from the stored one.
 * One at a time, giving the page a turn between each, so opening the shelf does not freeze it.
 */
export async function fichasNuevas(
  characters: SealedCharacter[],
  stored: Record<string, string>,
  rules: HojaRules,
): Promise<FichaFaro[]> {
  const out: FichaFaro[] = [];
  for (const entry of characters) {
    if (stored[entry.id] === entry.sealedAt) continue;
    await tick();
    try {
      const ficha = fichaDe(entry, rules);
      if (ficha) out.push(ficha);
    } catch {
      // One character that does not compute must not keep the others from reaching Discord.
    }
  }
  return out;
}
