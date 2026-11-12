/**
 * Cuál de nuestros números va en cuál de las casillas de la hoja.
 *
 * Es una tabla de correspondencias y se lee como tal: acá no se calcula nada,
 * `sheet-data.ts` ya juntó al personaje y esto dice dónde vive cada dato entre
 * los 1030 atributos de la hoja OGL.
 *
 * Los nombres salieron de la captura, no de la memoria, y la hoja OGL no los
 * escribe como la Shaped: acá la CA es `attr_ac` y no `attr_AC`, las pericias
 * no son filas sino `attr_perception_bonus`, y los ataques van en
 * `repeating_attack` con `attr_atkname`. El mapa está incompleto a propósito:
 * un nombre que no existe no llena nada y no cuesta nada, así que la forma de
 * extenderlo es mirar la hoja, encontrar una casilla vacía y buscar su `attr_`
 * en `vendor/roll20-ogl/captura-v4.21.html`.
 *
 * Un detalle de formato que se ve raro y es correcto: los modificadores van sin
 * signo (`4`, no `+4`). Así los escribe roll20 — el `-` de los negativos es del
 * número, no un signo agregado — y la CSS de la hoja cuenta con eso.
 */

import type { SheetData } from "./sheet-data";

/** Nuestras abreviaturas contra las de la hoja. */
const ABILITY_STEM: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

/** roll20 guarda cada bandera como la cadena `"1"` o `"0"`. */
const flag = (on: boolean) => (on ? "1" : "0");

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** `"sleight of hand"` es `sleight_of_hand`, que es como la hoja lo nombra. */
const skillKey = (name: string) => name.toLowerCase().replace(/\s+/g, "_");

function damageOf(attack: SheetData["attacks"][number]): string {
  const dice = attack.versatileDamage
    ? `${attack.damage} (${attack.versatileDamage})`
    : (attack.damage ?? "");
  return [dice, attack.damageType].filter(Boolean).join(" ");
}

export function oglDataFor(data: SheetData): OglData {
  const attrs: Record<string, string | number> = {
    attr_character_name: data.characterName,
    attr_class_display: data.classLine,
    attr_level: data.level,
    attr_race_display: data.speciesLabel,
    attr_race: data.speciesLabel,
    attr_background: data.backgroundLabel,
    attr_alignment: data.alignment,
    attr_size: data.sizeLabel,

    attr_ac: data.armorClass,
    attr_initiative_bonus: data.initiative,
    attr_speed: data.speed ?? "",
    attr_hp: data.hitPoints,
    attr_hp_max: data.hitPoints,
    attr_hit_dice: data.level,
    attr_hit_dice_max: data.level,
    // El selector de dado de golpe guarda el número pelado: `10` es d10.
    attr_hitdietype: data.hitDie ?? "",

    attr_pb: data.proficiencyBonus,
    attr_passive_wisdom: data.passivePerception,

    // La hoja imprime estas cuatro listas como texto suelto, una caja cada una.
    attr_other_languages: data.languages.join(", "),
    attr_other_weapon: data.weaponProficiencies.join(", "),
    attr_other_tool: data.toolProficiencies.join(", "),

    attr_personality_traits: data.personality.trait,
    attr_ideals: data.personality.ideal,
    attr_bonds: data.personality.bond,
    attr_flaws: data.personality.flaw,

    attr_cp: data.purse.cp,
    attr_sp: data.purse.sp,
    attr_ep: data.purse.ep,
    attr_gp: data.purse.gp,
    attr_pp: data.purse.pp,
  };

  const armour = data.armorTraining;
  attrs.attr_other_armor = [
    armour.light && "Ligera",
    armour.medium && "Media",
    armour.heavy && "Pesada",
    armour.shields && "Escudos",
  ]
    .filter(Boolean)
    .join(", ");

  for (const ability of data.abilities) {
    const stem = ABILITY_STEM[ability.id];
    if (!stem) continue;

    attrs[`attr_${stem}`] = ability.score;
    attrs[`attr_${stem}_base`] = ability.score;
    attrs[`attr_${stem}_mod`] = ability.modifier;
    attrs[`attr_${stem}_save_bonus`] = ability.save.modifier;
    attrs[`attr_${stem}_save_prof`] = flag(ability.save.proficient);

    for (const check of ability.skills) {
      const key = skillKey(check.name);
      attrs[`attr_${key}_bonus`] = check.modifier;
      attrs[`attr_${key}_prof`] = flag(check.proficient);
      // La hoja multiplica la competencia por este número, que es 2 cuando la
      // pericia está duplicada. Sin él un experto se dibuja como competente.
      attrs[`attr_${key}_type`] = check.expert ? 2 : 1;
    }
  }

  if (data.spellcasting) {
    const stem = ABILITY_STEM[data.spellcasting.ability] ?? data.spellcasting.ability;
    // El selector guarda el trozo de macro, no el nombre de la característica.
    attrs.attr_spell_ability = `@{${stem}_mod}+`;
    attrs.attr_spell_save_dc = data.spellcasting.saveDC;
    attrs.attr_spell_attack_bonus = data.spellcasting.attackBonus;

    for (const [level, slots] of Object.entries(data.spellcasting.slots)) {
      attrs[`attr_lvl${level}_slots_total`] = slots;
    }
  }

  const attacks: OglRow[] = data.attacks.map((attack) => ({
    attr_atkname: attack.quantity > 1 ? `${attack.name} ×${attack.quantity}` : attack.name,
    attr_atkbonus: signed(attack.attackBonus),
    attr_atkdmgtype: damageOf(attack),
  }));

  const inventory: OglRow[] = data.equipment.map((entry) => ({
    attr_itemname: entry.label,
    attr_itemcount: entry.quantity,
    attr_equipped: "1",
  }));

  /** `attr_source` es el desplegable que la hoja usa para filtrar la lista. */
  const traitsFrom = (names: string[], source: string, sourceType: string): OglRow[] =>
    names.map((name) => ({
      attr_name: name,
      attr_source: source,
      attr_source_type: sourceType,
    }));

  const traits: OglRow[] = [
    ...traitsFrom(data.speciesTraits, "Race", data.speciesLabel),
    ...traitsFrom(data.classFeatures, "Class", data.classLine),
    ...traitsFrom(data.feats, "Feat", ""),
    ...traitsFrom(data.backgroundFeatures, "Background", data.backgroundLabel),
  ];

  /*
   * El tipo de competencia, con las palabras que la hoja tiene.
   *
   * `attr_prof_type` es un `<select>` y sus cuatro opciones vienen traducidas en
   * la captura: IDIOMA, ARMA, ARMADURA, OTRO. Escribir "LANGUAGE" ahí no
   * selecciona ninguna —no existe esa opción— y deja la fila diciendo una
   * palabra en inglés en una hoja que está entera en español.
   *
   * Son las etiquetas y no un código: la hoja guarda el texto visible de la
   * opción, así que lo que se escribe acá es lo que hay que ver.
   */
  const proficiencies: OglRow[] = [
    ...data.languages.map((name) => ({ attr_name: name, attr_prof_type: "IDIOMA" })),
    ...data.weaponProficiencies.map((name) => ({ attr_name: name, attr_prof_type: "ARMA" })),
    ...data.toolProficiencies.map((name) => ({ attr_name: name, attr_prof_type: "OTRO" })),
  ];

  const rows: Record<string, OglRow[]> = {
    repeating_attack: attacks,
    repeating_inventory: inventory,
    repeating_traits: traits,
    repeating_proficiencies: proficiencies,
  };

  // Los conjuros van en una lista por nivel, y el nivel 0 tiene nombre propio.
  for (let level = 0; level <= 9; level += 1) {
    const bucket = data.spellsByLevel.find((entry) => entry.level === level);
    rows[`repeating_spell-${level === 0 ? "cantrip" : level}`] = (bucket?.spells ?? []).map(
      (spell) => ({
        attr_spellname: spell.label,
        attr_spelllevel: level,
        attr_spellprepared: flag(spell.prepared),
      }),
    );
  }

  return { attrs, rows };
}

/** Un valor como lo guarda roll20. Los booleanos son `"1"` y `"0"`. */
export type OglValue = string | number;

export type OglRow = Record<string, OglValue>;

export type OglData = {
  /** Por nombre completo del atributo, `attr_` incluido. */
  attrs: Record<string, OglValue>;
  /** Por grupo, como lo nombra `data-groupname`: `repeating_attack`. */
  rows: Record<string, OglRow[]>;
};
