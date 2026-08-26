import {
  type CharacterBuild,
  type CharacterBuildInput,
  characterBuildInputSchema,
  characterBuildSchema,
} from "@bertinis-vault/contracts";
import { getArmorCatalogEntry } from "@bertinis-vault/data-engine";
import { abilityModifierMap } from "./abilities.js";
import { bestArmorClass } from "./armor-class.js";
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

  // What the worn armour is worth on its own. The shield is added by
  // `bestArmorClass`, because a shield applies to whichever calculation wins
  // rather than only to this one.
  const armorFormula = indexedArmor?.armorFormula ?? armorEntry?.armorFormula ?? "10+DEX";
  const wornArmorClass = calculateArmorClass({ armorFormula, dexModifier: modifiers.dex });

  // Unarmored Defense and the rest. This is the line that was missing: the
  // parameter for it has existed since the beginning and nothing ever passed
  // it, so a barbarian with 16 Constitution was shown three lower than they
  // are, with nothing on the sheet to say a number had gone missing.
  const { ac } = bestArmorClass({
    options: parsedInput.choices.normalized?.armorClassOptions ?? [],
    modifiers,
    wornArmorClass,
    isWearingArmor: Boolean(indexedArmor ?? armorEntry),
    hasShield,
    level,
    variantsTaken: parsedInput.choices.features,
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
