/**
 * The sheet as Faro del Alba's Discord plate reads it.
 *
 * The Forge is the only place that can compute a character's sheet, so it hands the compact result to the profile,
 * which stores it with the account. A character that was never in a world can then be shown in Discord.
 */
import { isStoredImage } from "@/lib/cover-image";
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
  /** The portrait and the player's own banner, already reduced to JPEG data URLs: what the plate draws. */
  retratoDatos: string | null;
  fondoDatos: string | null;
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
    atributos: ORDEN.map((key) => {
      const ability = data.abilities[key];
      return { clave: key.toUpperCase(), valor: ability?.score ?? null, mod: ability?.modifier ?? null, salva: ability?.save.modifier ?? null, competente: ability?.save.proficient ?? false };
    }),
    salvacionesPf2e: [],
    habilidades: Object.entries(HABILIDADES).flatMap(([key, nombre]) => {
      const skill = data.skills[key];
      return skill
        ? [{ nombre, total: skill.modifier, rango: skill.expert ? 2 : skill.proficient ? 1 : 0, atributo: skill.ability.toUpperCase() }]
        : [];
    }),
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

const MAX_CHARS = 450_000;

/**
 * A picture reduced to what the plate can use: a JPEG no larger than the box, as a data URL.
 *
 * The plate's renderer does not read WebP and a whole portrait made every plate slow to draw, so the browser —
 * which reads anything — hands over a small JPEG. Only the player's own images (inline, or kept in the build
 * store) are taken. Null when it cannot be read or will not fit.
 */
export async function jpegDe(src: string, box: { w: number; h: number }): Promise<string | null> {
  if (!(src.startsWith("data:image/") || isStoredImage(src))) return null;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    await image.decode();
    const k = Math.min(1, box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = Math.max(1, Math.round(image.naturalWidth * k)), h = Math.max(1, Math.round(image.naturalHeight * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);
    for (const quality of [0.86, 0.72, 0.58]) {
      const uri = canvas.toDataURL("image/jpeg", quality);
      if (uri.length <= MAX_CHARS) return uri;
    }
    return null;
  } catch {
    return null;
  }
}

/** The plate for one sealed character, or null when it does not derive (an old tome missing a pick). */
export async function fichaDe(entry: SealedCharacter, rules: HojaRules): Promise<FichaFaro | null> {
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
    retratoDatos: entry.state.coverImage ? await jpegDe(entry.state.coverImage, { w: 820, h: 1000 }) : null,
    fondoDatos: isStoredImage(entry.state.bannerImage) ? await jpegDe(entry.state.bannerImage, { w: 1860, h: 1000 }) : null,
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
      const ficha = await fichaDe(entry, rules);
      if (ficha) out.push(ficha);
    } catch {
      // One character that does not compute must not keep the others from reaching Discord.
    }
  }
  return out;
}
