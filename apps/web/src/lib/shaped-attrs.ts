/**
 * Which of our numbers goes in which of the sheet's boxes.
 *
 * The whole of this file is a mapping table and it is meant to be read as one.
 * Nothing here computes anything: `sheet-data.ts` gathered the character and
 * this says where each fact lives in the roll20 sheet's 845 attributes.
 *
 * The names are not guesses — they were read off the vendored HTML — but the
 * map is certainly incomplete, and that is the expected state. A name that
 * matches nothing fills nothing and costs nothing, so the way to extend this is
 * to look at the rendered sheet, find an empty box, find its `attr_` name in
 * `vendor/5eshaped/5eShaped.html`, and add the line.
 *
 * Labels come from the sheet's own translation file rather than from us: a
 * skill named here in Spanish would sit under a heading the sheet writes in
 * English, and two vocabularies on one sheet read as a bug.
 */

import type { SheetData } from "./sheet-data";
import type { ShapedData, ShapedRow } from "./shaped-render";

/** Our ability ids against the sheet's attribute stems. */
const ABILITY_STEM: Record<string, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

/** Roll20 stores every flag as the string `"1"` or `"0"`. */
const flag = (on: boolean) => (on ? "1" : "0");

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** `"acrobatics"` is `ACROBATICS`, `"animal handling"` is `ANIMAL_HANDLING`. */
function labelKey(name: string): string {
  return name.toUpperCase().replace(/\s+/g, "_");
}

function damageOf(attack: SheetData["attacks"][number]): string {
  const dice = attack.versatileDamage
    ? `${attack.damage} (${attack.versatileDamage})`
    : (attack.damage ?? "");
  return [dice, attack.damageType].filter(Boolean).join(" ");
}

export function shapedDataFor(data: SheetData, labels: Record<string, string>): ShapedData {
  const label = (key: string) => labels[key] ?? key;

  const attrs: Record<string, string | number> = {
    // The sheet opens on the character page in its display face rather than
    // its edit face. Both are `value=` attributes the stylesheet reads.
    attr_tab: "character",
    attr_edit_mode: "0",
    attr_is_npc: "0",

    attr_character_name: data.characterName,
    attr_class_and_level: data.classLine,
    attr_race: data.speciesLabel,
    attr_background: data.backgroundLabel,
    attr_alignment: data.alignment,
    attr_size: data.sizeLabel,

    attr_AC: data.armorClass,
    attr_initiative: data.initiative,
    attr_speed: data.speed ?? "",
    attr_speed_string: data.speed ? `${data.speed}` : "",
    attr_HP: data.hitPoints,
    attr_HP_max: data.hitPoints,
    attr_hit_dice: data.hitDie ? `${data.level}d${data.hitDie}` : "",
    // The bonus is `PB`; `attr_proficiency` is the checkbox on a skill row.
    attr_PB: data.proficiencyBonus,
    attr_pb_display: data.proficiencyBonus,
    attr_languages: data.languages.join(", "),
  };

  for (const ability of data.abilities) {
    const stem = ABILITY_STEM[ability.id];
    if (!stem) continue;

    attrs[`attr_${stem}`] = ability.score;
    attrs[`attr_${stem}_calculated`] = ability.score;
    attrs[`attr_${stem}_mod`] = ability.modifier;
    attrs[`attr_${stem}_mod_with_sign`] = signed(ability.modifier);
    attrs[`attr_${stem}_check_mod_with_sign`] = signed(ability.modifier);
    attrs[`attr_${stem}_saving_throw_mod_with_sign`] = signed(ability.save.modifier);
    attrs[`attr_${stem}_saving_throw_proficient`] = flag(ability.save.proficient);
  }

  if (data.spellcasting) {
    const stem = ABILITY_STEM[data.spellcasting.ability] ?? data.spellcasting.ability;
    attrs.attr_spell_ability = stem;
    attrs.attr_spell_save_DC = data.spellcasting.saveDC;
    attrs.attr_spell_attack_bonus = signed(data.spellcasting.attackBonus);
  }

  const skills: ShapedRow[] = data.abilities.flatMap((ability) =>
    ability.skills.map((check) => ({
      attr_name: label(labelKey(check.name)),
      attr_ability: `@{${ABILITY_STEM[check.ability] ?? check.ability}_mod}`,
      attr_total_with_sign: signed(check.modifier),
      attr_passive: 10 + check.modifier,
      attr_proficiency: check.expert ? "2" : flag(check.proficient),
      attr_prof_toggle: flag(check.proficient),
    })),
  );

  const offense: ShapedRow[] = data.attacks.map((attack) => ({
    attr_name: attack.quantity > 1 ? `${attack.name} ×${attack.quantity}` : attack.name,
    attr_attack_bonus: attack.attackBonus,
    attr_attack_string: signed(attack.attackBonus),
    attr_attack_damage_string: damageOf(attack),
    attr_attack_damage_type: attack.damageType ?? "",
    attr_attack_ability: `@{${attack.ability}_mod}`,
  }));

  const equipment: ShapedRow[] = data.equipment.map((entry) => ({
    attr_name: entry.quantity > 1 ? `${entry.label} ×${entry.quantity}` : entry.label,
    attr_carried: "1",
  }));

  const traits: ShapedRow[] = data.speciesTraits.map((name) => ({ attr_name: name }));
  const classFeatures: ShapedRow[] = data.classFeatures.map((name) => ({ attr_name: name }));
  const feats: ShapedRow[] = [...data.feats, ...data.backgroundFeatures].map((name) => ({
    attr_name: name,
  }));

  const rows: Record<string, ShapedRow[]> = {
    repeating_skill: skills,
    repeating_offense: offense,
    repeating_equipment: equipment,
    repeating_racialtrait: traits,
    repeating_classfeature: classFeatures,
    repeating_feat: feats,
  };

  // The sheet keeps a separate list per spell level, `repeating_spell0` through
  // `repeating_spell9`, which is why this is a loop and not one assignment.
  for (const bucket of data.spellsByLevel) {
    rows[`repeating_spell${bucket.level}`] = bucket.spells.map((spell) => ({
      attr_name: spell.label,
      attr_prepared: flag(spell.prepared),
    }));
  }

  return { attrs, rows };
}
