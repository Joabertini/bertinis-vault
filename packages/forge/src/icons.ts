/**
 * Which icon an item, a spell or a rules entry wears.
 *
 * There are about 4,750 things to mark and a few hundred drawings, so an icon
 * says what *kind* of thing it is: a longsword and a rapier both wear the
 * sword, a fireball and a burning hands both wear the fireball. Where the
 * painted packs have nothing for a kind (tools, instruments, mounts…) the
 * answer is a game-icons.net silhouette, drawn by the page in gold on the
 * same dark tile, so it does not shout next to the painted ones.
 *
 * Variety inside a kind comes from the name, not from chance: the same potion
 * is the same colour every time.
 */

import {
  ICON_SHEET_KEYS,
  ICON_SILHOUETTES,
  type SheetIconKey,
  type SilhouetteIconKey,
} from "./icon-atlas.js";

export type IconKey = SheetIconKey | SilhouetteIconKey;

export type IconItemRow = {
  name: string;
  type?: string | null;
  rarity?: string | null;
  weaponCategory?: string | null;
};

export type IconSpellRow = { name: string; school: string };

export type IconKind = "feat" | "species" | "background" | "subclass" | "feature";

const SHEET = new Set<string>(ICON_SHEET_KEYS);

/** Painted, from the sprite sheet; anything else is a silhouette. */
export function isSheetIcon(key: IconKey): key is SheetIconKey {
  return SHEET.has(key);
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** One of `keys`, always the same for the same `name`. */
function pick<T extends IconKey>(keys: readonly T[], name: string): T {
  return keys[hash(name.toLowerCase()) % keys.length]!;
}

const magical = (row: IconItemRow) => !!row.rarity && row.rarity !== "none" && row.rarity !== "unknown (magic)" ;

/* -------------------------------------------------------------------------- */
/*  Items                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Weapons, by what their name says: each kind its own drawing, so a longsword,
 * a shortsword and a rapier are three different blades. The last rule is the
 * catch-all, a blade. A magic blade wears the magic mark instead of its shape.
 */
const WEAPONS: [RegExp, (row: IconItemRow) => IconKey][] = [
  [/\bstaff\b|\brod\b/, () => "staff"],
  [/dagger|knife|dirk|sickle|shiv|\bdarts?\b/, (r) => (magical(r) ? "magic-dagger" : "dagger")],
  [/greataxe/, () => "axe"],
  [/battleaxe/, () => "battleaxe"],
  [/handaxe|hatchet/, () => "handaxe"],
  [/halberd|glaive|poleaxe|voulge|labrys/, () => "halberd"],
  [/\baxe\b/, () => "axe-d"],
  [/warhammer/, () => "warhammer"],
  [/\bmaul\b|great ?hammer/, () => "hammer-heavy"],
  [/hammer/, () => "hammer"],
  [/war pick|\bpick\b/, () => "pickaxe"],
  [/trident/, () => "trident"],
  [/flail/, () => "flail"],
  [/mace|morningstar|morning star|scepter/, () => "mace"],
  [/club|quarterstaff/, () => "club"],
  [/\b(spear|lance|javelin|pike)s?\b/, () => "spear"],
  [/hand crossbow|heavy crossbow/, () => "crossbow-d"],
  [/crossbow|musket|pistol|firearm|rifle|\bgun\b/, () => "crossbow"],
  [/longbow/, () => "bow-long"],
  [/sling/, () => "sling"],
  [/boomerang/, () => "boomerang"],
  [/bow|blowgun/, () => "bow"],
  [/whip|\bnet\b/, () => "whip"],
  [/greatsword|claymore|zweih/, (r) => (magical(r) ? "magic-sword" : "greatsword")],
  [/rapier|estoc/, (r) => (magical(r) ? "magic-sword" : "sword-rapier")],
  [/shortsword|short sword|gladius/, (r) => (magical(r) ? "magic-sword" : "sword-short")],
  [/scimitar|sabre|saber|cutlass|falchion|katana/, (r) => (magical(r) ? "magic-sword" : "sword")],
  [/.*/, (r) => (magical(r) ? "magic-sword" : "sword-long")],
];

type Rule = { when: RegExp; types: string[]; key: (row: IconItemRow) => IconKey };

const GENERAL: Rule[] = [
  { types: ["A"], when: /arrow|bolt|bullet|quiver|needle|shot/, key: () => "arrows" },
  { types: ["ST"], when: /staff/, key: () => "staff" },
  { types: ["RD"], when: /\brod\b/, key: () => "staff" },
  { types: ["WD"], when: /wand/, key: () => "wand" },
  { types: ["SCF"], when: /amulet|necklace|pendant|periapt|medallion|talisman|brooch|locket|holy symbol|emblem|badge|medal|choker|torc/, key: (r) => pick(["amulet", "amulet-green"], r.name) },
  {
    types: ["S"],
    when: /shield|buckler/,
    key: (r) =>
      /buckler|wooden|round/i.test(r.name)
        ? "shield-round"
        : /spiked|tower|wall/i.test(r.name)
          ? "shield-spiked"
          : /^shield$/i.test(r.name.trim())
            ? "shield"
            : pick(["shield", "shield-round", "shield-heraldic", "shield-spiked"], r.name),
  },
  {
    types: ["LA", "MA", "HA"],
    when: /armor|armour|mail|plate|breastplate|hide|cuirass|robe\b|cloak|cape|mantle|vestment|tunic/,
    key: (r) => {
      const n = r.name.toLowerCase();
      if (/robe|cloak|cape|mantle|vestment|tunic/.test(n)) return "cloak";
      if (/half plate/.test(n)) return "armor-gold";
      if (/\bplate\b|splint/.test(n)) return "armor-silver";
      if (/chain|ring mail/.test(n)) return "armor";
      if (/scale|breastplate|cuirass/.test(n)) return "armor-heavy";
      if (/studded/.test(n)) return "armor-dark";
      if (/padded|hide/.test(n)) return "armor-cloth";
      if (/leather/.test(n)) return "armor-leather";
      return pick(["armor", "armor-heavy", "armor-dark", "armor-leather"], r.name);
    },
  },
  { types: ["RG"], when: /\bring\b|signet/, key: (r) => pick(["ring", "ring-green", "ring-magic"], r.name) },
  { types: ["P"], when: /potion|elixir|philter|oil of|antitoxin|draught|tonic|holy water|brew|poison|acid/, key: (r) => pick(["potion-red", "potion-blue", "potion-yellow", "potion-green", "potion-pink"], r.name) },
  { types: ["SC"], when: /scroll|parchment|letter/, key: (r) => pick(["scroll", "scroll-red", "scroll-green"], r.name) },
  { types: [], when: /helm|\bhat\b|crown|circlet|\bcap\b|mask|hood|headband|diadem|tiara/, key: (r) => (/crown|circlet|diadem|tiara/i.test(r.name) ? "crown" : /hood/i.test(r.name) ? "hood" : /hat\b/i.test(r.name) ? "hat" : /leather|\bcap\b/i.test(r.name) ? "helmet-leather" : pick(["helm", "helmet", "helmet-gold"], r.name)) },
  { types: [], when: /cloak|\bcape\b|mantle|\brobes?\b|vestment/, key: () => "cloak" },
  { types: [], when: /boots|shoes|slippers|sandals/, key: (r) => pick(["boots", "boots-plate"], r.name) },
  { types: [], when: /gloves?|gauntlets?|bracers?|bracelet|armlet/, key: (r) => pick(["gloves", "gloves-plate", "glove"], r.name) },
  { types: [], when: /book|tome|manual|spellbook|grimoire|codex|folio|almanac|lexicon|treatise|prayer/, key: (r) => pick(["book-red", "book-blue", "book-green", "book-holy", "book-arcane", "tome"], r.name) },
  { types: [], when: /backpack/, key: () => "backpack" },
  { types: [], when: /bag\b|pouch|sack|satchel|haversack|purse|basket|barrel|crate|trunk|pack\b/, key: () => "bag" },
  { types: [], when: /\bchest\b|\bcase\b/, key: () => "chest" },
  { types: [], when: /coin|money|platinum|currency|\bgold\b/, key: () => "coin" },
  { types: ["$G"], when: /gem|jewel|diamond|ruby|emerald|sapphire|pearl|opal|topaz|crystal|amber|jade|agate|onyx|quartz|shard|obsidian/, key: (r) => pick(["gem-red", "gem-blue", "gem-green", "gem-amber", "gem-violet", "gem-white"], r.name) },
  { types: [], when: /\bioun\b|\borb\b/, key: () => "orb" },
  { types: ["FD"], when: /food|bread|meat|apple|cheese|ration|feast|meal|fruit|berry|honey|jerky|cake|soup|stew|mushroom|egg|fish|candy/, key: (r) => pick(["bread", "meat", "cheese", "chicken", "stew"], r.name) },
  { types: [], when: /\bkey\b|padlock|manacles|handcuffs|shackles/, key: (r) => pick(["key", "key-gold"], r.name) },
  { types: ["INS"], when: /drum/, key: () => "drum" },
  { types: ["INS"], when: /horn|bagpipe|pipes|shawm/, key: () => "horn" },
  { types: ["INS"], when: /./, key: () => "instrument" },
  { types: ["MNT"], when: /./, key: () => "mount" },
  { types: ["TAH"], when: /./, key: () => "saddle" },
  { types: ["SHP", "AIR"], when: /./, key: () => "ship" },
  { types: ["VEH", "SPC"], when: /./, key: (r) => (/ship|boat|galley|raft|canoe|warship/i.test(r.name) ? "ship" : "wagon") },
  { types: ["EXP"], when: /./, key: () => "explosive" },
  { types: ["GS"], when: /dice/, key: () => "dice" },
  { types: ["GS"], when: /./, key: () => "cards" },
  { types: [], when: /\b(horse|pony|mule|camel|elephant|steed)s?\b/, key: () => "mount" },
  { types: [], when: /saddle|bridle/, key: () => "saddle" },
  { types: [], when: /\bcart\b|\bwagon\b|\bcarriage\b|\bsled\b/, key: () => "wagon" },
  { types: [], when: /\b(boat|ship|galley|raft|canoe|keelboat|warship)s?\b/, key: () => "ship" },
  { types: [], when: /bomb|grenade|explosive|powder|dynamite|firework/, key: () => "explosive" },
  { types: [], when: /\bcards?\b|\bdeck\b|playing|chess/, key: () => "cards" },
  { types: [], when: /lantern|lamp|torch|candle/, key: () => "lantern" },
  { types: [], when: /rope|grappling/, key: () => "rope" },
  { types: [], when: /tent|bedroll|blanket/, key: () => "camp" },
  { types: [], when: /hourglass/, key: () => "hourglass" },
  { types: [], when: /quill|\bink\b/, key: () => "quill" },
  { types: [], when: /spyglass|telescope|lens/, key: () => "spyglass" },
  { types: [], when: /\bbell\b/, key: () => "bell" },
  { types: [], when: /banner|flag\b/, key: () => "banner" },
  { types: [], when: /lockpick|thieves/, key: () => "lockpicks" },
  { types: [], when: /\bpick\b|shovel|crowbar/, key: () => "pickaxe" },
  { types: ["AT", "T", "G"], when: /alchemist|mortar|herbalism|poisoner/, key: () => "mortar" },
  { types: ["AT", "T", "G"], when: /./, key: () => "tools" },
  { types: ["$A"], when: /./, key: () => "crown" },
];

/** The icon for an item. Always answers: an unplaced magic item wears the sparkle. */
export function itemIconKey(row: IconItemRow): IconKey {
  const name = row.name.toLowerCase();
  const type = (row.type ?? "").split("|")[0] ?? "";

  if (type === "M" || type === "R" || row.weaponCategory) {
    const weapon = WEAPONS.find(([rx]) => rx.test(name));
    if (weapon) return weapon[1](row);
  }
  for (const rule of GENERAL) {
    if (rule.types.length > 0 && rule.types.includes(type) && rule.when.test(name)) return rule.key(row);
  }
  // A name that says what it is wins even without a type: most magic items carry none.
  for (const rule of GENERAL) {
    if (rule.when.source !== "." && rule.when.test(name)) return rule.key(row);
  }
  for (const rule of GENERAL) {
    if (rule.types.length > 0 && rule.types.includes(type)) return rule.key(row);
  }
  return magical(row) ? "magic-item" : "bag";
}

/** Whether an item got a drawing of its own kind rather than the catch-all. */
export function itemHasOwnIcon(row: IconItemRow): boolean {
  const key = itemIconKey(row);
  return key !== "magic-item" && key !== "bag";
}

/* -------------------------------------------------------------------------- */
/*  Spells                                                                    */
/* -------------------------------------------------------------------------- */

const SPELL_THEMES: [RegExp, IconKey][] = [
  [/fire|flame|burn|inferno|incend|scorch|meteor|sunbeam|molten|lava/, "spell-fire"],
  [/chill touch/, "spell-necrotic"],
  [/\bice\b|frost|cold|freez|snow|winter|chill|hail|sleet/, "spell-ice"],
  [/lightning|thunder|shock|storm|spark/, "spell-lightning"],
  [/heal|cure|restor|revive|raise dead|resurrect|regenerat|vitality|renew|mend|life/, "spell-heal"],
  [/ward|protect|shield|armor|sanctuary|aegis|barrier|globe|resist|sentinel|guard|counterspell|dispel|antimagic/, "spell-protect"],
  [/charm|enchant|suggest|command|\bhold\b|sleep|fear|geas|compel|dominate|bless|bane|hex|curse|confus|calm|befuddle|friend|hypnot|enthrall|slow|banish/, "spell-enchant"],
  [/detect|\bsee\b|sight|\beye|clairvoy|scry|locat|identify|divin|augur|true|vision|sensor|commune|contact|legend|telepath/, "spell-eye"],
  [/death|wither|vampir|necro|undead|false life|blight|harm|disintegr|soul|chill touch|inflict|poison|toxic|bone|grave|decay|shadow|dark|dread|horror/, "spell-necrotic"],
  [/wind|gust|\bair\b|fog|cloud|whirl|tornado|\bfly\b|levitat|feather|gaseous|cyclone|breeze/, "spell-wind"],
  [/stone|earth|rock|quake|wall of|boulder|mold earth|mud|sand|crystal|meld|erupt/, "spell-earth"],
  [/plant|vine|tree|entangle|thorn|grow|spike|barkskin|bush|animal|beast|speak with|conjure|summon|call|swarm|druid|flower|moss|spider/, "spell-plant"],
  [/haste|speed|swift|time|step|jump|teleport|door|blink|portal|misty|dimension/, "spell-haste"],
  [/force|missile|\bray\b|beam|eldritch|bolt|arrow|blast|smite|weapon|strike|bladed|spirit|sword|dagger/, "spell-force"],
  [/light|radiant|holy|sacred|divine|\bsun\b|dawn|\bday\b|prayer|beacon/, "light"],
  [/water|wave|tide|flood|rain|\bsea\b|ocean|steam|bubble|acid/, "water"],
  [/rune|glyph|symbol|sigil|mark/, "spell-rune"],
];

const SCHOOLS: Record<string, IconKey> = {
  A: "school-abjuration",
  C: "school-conjuration",
  D: "school-divination",
  E: "school-enchantment",
  V: "school-evocation",
  I: "school-illusion",
  N: "school-necromancy",
  T: "school-transmutation",
  // The picker lists spells by the Spanish name the index gives.
  Abjuracion: "school-abjuration",
  Conjuracion: "school-conjuration",
  Adivinacion: "school-divination",
  Encantamiento: "school-enchantment",
  Evocacion: "school-evocation",
  Ilusion: "school-illusion",
  Nigromancia: "school-necromancy",
  Transmutacion: "school-transmutation",
};

/** The icon for a spell: its theme if the name has one, its school otherwise. */
export function spellIconKey(row: IconSpellRow): IconKey {
  const name = row.name.toLowerCase();
  for (const [rx, key] of SPELL_THEMES) if (rx.test(name)) return key;
  return SCHOOLS[row.school] ?? "spell-force";
}

/** Whether the spell got a theme of its own rather than its school's. */
export function spellHasOwnIcon(row: IconSpellRow): boolean {
  return SPELL_THEMES.some(([rx]) => rx.test(row.name.toLowerCase()));
}

/* -------------------------------------------------------------------------- */
/*  Everything else                                                           */
/* -------------------------------------------------------------------------- */

const KINDS: Record<IconKind, IconKey> = {
  feat: "kind-feat",
  species: "kind-species",
  background: "kind-background",
  subclass: "kind-subclass",
  feature: "kind-feature",
};

/** One mark per kind of rules entry. Classes keep their sigils (`class-icon-paths`). */
export function kindIconKey(kind: IconKind): IconKey {
  return KINDS[kind];
}

/** The strokes of a silhouette icon, viewBox 512x512. */
export function silhouetteStrokes(key: SilhouetteIconKey): string {
  return ICON_SILHOUETTES[key];
}

/** Species, by what the name says; the rest keep the species mark. */
const SPECIES: [RegExp, IconKey][] = [
  [/dragon|drake|kobold/, "dragon"],
  [/orc|goblin|hobgoblin|bugbear|ogre|giff/, "orc"],
  [/tabaxi|leonin|lion|cat\b|grung|owlin/, "bigcat"],
  [/aarakocra|aven|kenku|raven|harengon|bird/, "bird"],
  [/elf|eladrin|drow|fey|sprite|satyr|shadar|hexblood|pixie/, "leaf"],
  [/dwarf|duergar|dwarves/, "hammer"],
  [/aasimar|firbolg|celestial/, "light"],
  [/tiefling|fiend|infernal|yuan-ti|yuan ti/, "spell-fire"],
  [/genasi|elemental|shardmind|earth|air\b/, "crystal"],
  [/triton|merfolk|locathah|sea|aquatic|water/, "water"],
  [/warforged|autognome|construct|plasmoid|android/, "tools"],
  [/dhampir|revenant|undead|vampire|reborn|zombie/, "skull"],
  [/centaur|minotaur|loxodon|horse|bovine/, "mount"],
  [/lizardfolk|tortle|thri-kreen|changeling|shifter|lycan|beast|ratfolk|simic/, "paw"],
  [/gnome|halfling|goliath|human|variant/, "kind-species"],
];

/** The icon for a species or subrace. */
export function speciesIconKey(name: string): IconKey {
  const n = name.toLowerCase();
  return SPECIES.find(([rx]) => rx.test(n))?.[1] ?? kindIconKey("species");
}

/** Backgrounds: the common ones by trade, the rest keep the background mark. */
const BACKGROUNDS: [RegExp, IconKey][] = [
  [/acolyte|cloistered|monk|initiate|faith|priest|temple/, "book-holy"],
  [/charlatan|gambler|rival|fortune|trickster|con\b/, "cards"],
  [/criminal|spy|smuggler|thief|urban|haunted/, "lockpicks"],
  [/entertainer|gladiator|performer|bard|minstrel|musician/, "instrument"],
  [/folk hero|hero|farmer|local/, "banner"],
  [/guild|artisan|merchant|craft|shopkeeper|investigator/, "tools"],
  [/hermit|recluse|wanderer/, "campfire"],
  [/noble|knight|retainer|courtier|royal|house/, "crown"],
  [/outlander|ranger|hunter|exile|feral|forest|tribal/, "paw"],
  [/sage|scholar|student|archaeolog|anthropolog|librarian|college|researcher/, "book-arcane"],
  [/sailor|pirate|ship|marine|dock|fisher/, "ship"],
  [/soldier|guard|mercenary|veteran|warrior|army|city watch|watch/, "sword-long"],
  [/urchin|orphan|street|haunt|beggar|vagabond/, "bag"],
  [/athlete|champion|boxer/, "fist"],
];

export function backgroundIconKey(name: string): IconKey {
  const n = name.toLowerCase();
  return BACKGROUNDS.find(([rx]) => rx.test(n))?.[1] ?? kindIconKey("background");
}
