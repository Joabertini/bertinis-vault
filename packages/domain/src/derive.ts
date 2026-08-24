import {
  type CharacterBuild,
  type CharacterBuildInput,
  characterBuildInputSchema,
  characterBuildSchema,
} from "@bertinis-vault/contracts";
import { getArmorCatalogEntry } from "@bertinis-vault/data-engine";
import { abilityModifierMap } from "./abilities.js";
import { calculateArmorClass, calculateEstimatedHitPoints } from "./combat.js";
import {
  getHitDieForClass,
  getSpellAbilityForClass,
  normalizeClassId,
} from "./dnd5e-2014.js";
import { spellSlotsForPayload } from "./spell-slots-payload.js";
import { getCharacterLevel, getProficiencyBonus } from "./progression.js";

export function deriveCharacterBuild(
  input: CharacterBuildInput,
): CharacterBuild {
  const parsedInput = characterBuildInputSchema.parse(input);
  const level = getCharacterLevel(parsedInput.classing.classes.map((entry) => entry.level));
  const proficiencyBonus = getProficiencyBonus(level);
  const modifiers = abilityModifierMap(parsedInput.abilities.final);
  const primaryClassId = normalizeClassId(parsedInput.classing.classes[0]?.classId ?? "");
  const primaryClassLevel = parsedInput.classing.classes[0]?.level ?? 1;
  const hitDie = getHitDieForClass(primaryClassId);
  const spellAbility = getSpellAbilityForClass(primaryClassId);

  const hp = calculateEstimatedHitPoints({
    hitDie,
    level,
    constitutionModifier: modifiers.con,
  });

  // An armour picked from the index brings its own formula; the catalog is the
  // fallback for builds written before the index carried armour class.
  const normalizedEquipment = parsedInput.choices.normalized?.equipment ?? [];
  const indexedArmor = normalizedEquipment.find((entry) => entry.armorFormula);
  const armorEntry = parsedInput.choices.equipment
    .map((entry) => getArmorCatalogEntry(entry))
    .find((entry) => Boolean(entry));
  const hasShield =
    normalizedEquipment.some((entry) => entry.grantsShieldBonus) ||
    parsedInput.choices.equipment
      .map((entry) => getArmorCatalogEntry(entry))
      .some((entry) => entry?.grantsShieldBonus);

  const ac = calculateArmorClass({
    armorFormula: indexedArmor?.armorFormula ?? armorEntry?.armorFormula ?? "10+DEX",
    dexModifier: modifiers.dex,
    hasShield,
  });

  // Keyed by the level the slot is, which is the payload's shape rather than
  // Foundry's field names. The two were confused, and the result was a path
  // that did not exist.
  const slotRules = parsedInput.meta.rulesVersion === "5e-2024" ? "2024" : "2014";
  const payloadSlots = spellSlotsForPayload(primaryClassId, primaryClassLevel, slotRules);

  const spellcasting = spellAbility
      ? {
          ability: spellAbility,
          attackBonus: proficiencyBonus + modifiers[spellAbility],
          saveDC: 8 + proficiencyBonus + modifiers[spellAbility],
          slots: payloadSlots.slots,
          ...(payloadSlots.pactLevel ? { pactLevel: payloadSlots.pactLevel } : {}),
        }
      : undefined;

  const build: CharacterBuild = {
    ...parsedInput,
    derived: {
      proficiencyBonus,
      hp,
      ac,
      ...(spellcasting ? { spellcasting } : {}),
    },
  };

  return characterBuildSchema.parse(build);
}
