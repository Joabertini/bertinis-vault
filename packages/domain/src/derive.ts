import {
  type CasterProgression,
  type CharacterBuild,
  type CharacterBuildInput,
  characterBuildInputSchema,
  characterBuildSchema,
} from "@bertinis-vault/contracts";
import { getArmorCatalogEntry } from "@bertinis-vault/data-engine";
import { abilityModifierMap } from "./abilities.js";
import { bestArmorClass } from "./armor-class.js";
import {
  multiclassHitPoints,
  multiclassSpellSlots,
  progressionOf,
  type MulticlassEntry,
} from "./multiclass.js";
import { calculateArmorClass } from "./combat.js";
import {
  getHitDieForClass,
  getSpellAbilityForClass,
  getSpellProgressionForClass,
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
  const spellAbility = getSpellAbilityForClass(primaryClassId);

  // Every class, in the order they were taken. Where the index has not
  // supplied a class's numbers — a draft written before the fields existed, a
  // fixture — the hand-written tables stand in, which is why a single-class
  // build derives exactly what it always did.
  const entries: MulticlassEntry[] = parsedInput.classing.classes.map((entry) => {
    const id = normalizeClassId(entry.classId);
    return {
      classId: id,
      level: entry.level,
      casterProgression: entry.casterProgression ?? legacyProgression(id),
      subclassCasterProgression: entry.subclassCasterProgression ?? null,
      hitDie: entry.hitDie ?? getHitDieForClass(id),
      ...(entry.spellcastingAbility ? { spellcastingAbility: entry.spellcastingAbility } : {}),
    };
  });

  const isMulticlass = entries.length > 1;

  /*
   * The hit points, from the dice of the classes the levels were taken in and
   * from what the player rolled if they rolled. A build that says nothing gets
   * the average, which is what every build written before the field did.
   */
  const hp = multiclassHitPoints({
    entries,
    constitutionModifier: modifiers.con,
    ...(parsedInput.hitPoints?.method ? { method: parsedInput.hitPoints.method } : {}),
    ...(parsedInput.hitPoints?.rolls ? { rolls: parsedInput.hitPoints.rolls } : {}),
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

  // A multiclass spellcaster's slots are not the sum of what each class would
  // have alone: they come from one combined caster level read against the
  // full-caster table, and each class contributes a different fraction of its
  // levels. A wizard 3 / cleric 2 used to be given a wizard 3's slots.
  //
  // A subclass can also cast when its class does not, and then the class's own
  // table is the wrong one to read: the Eldritch Knight is a third-caster
  // built on a fighter, and asking the fighter's table for slots returns none.
  // Its levels have to go through the same fraction the combined table
  // applies, so it takes the same path a multiclass character does.
  const subclassCarriesTheCasting = entries.some(
    (entry) => !entry.casterProgression && entry.subclassCasterProgression,
  );

  const payloadSlots =
    isMulticlass || subclassCarriesTheCasting
      ? multiclassSpellSlots(entries)
      : spellSlotsForPayload(primaryClassId, primaryClassLevel, slotRules);

  // The ability comes from the first class that casts at all. A character
  // with two casting classes has two save DCs, which this contract has never
  // carried; naming the first is the honest partial answer rather than
  // silently picking whichever table was consulted last.
  //
  // Asked of every build, not only a multiclass one. Gated on `isMulticlass`,
  // a single-class Eldritch Knight fell through to the fighter's ability,
  // which is none — a character holding spells with no save DC to cast them
  // at. A single-class caster reaches the same answer either way: the entry's
  // ability comes from the same index row the fallback consults.
  const castingEntry = entries.find((entry) => progressionOf(entry) !== null);
  const spellAbilityForBuild =
    castingEntry?.spellcastingAbility ??
    getSpellAbilityForClass(castingEntry?.classId ?? "") ??
    spellAbility;

  const spellcasting = spellAbilityForBuild
      ? {
          ability: spellAbilityForBuild,
          attackBonus: proficiencyBonus + modifiers[spellAbilityForBuild],
          saveDC: 8 + proficiencyBonus + modifiers[spellAbilityForBuild],
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

/**
 * The progression the hand-written table knows, in the index's vocabulary.
 *
 * A stand-in for builds written before the index supplied the field. It knows
 * only one edition, which is exactly why the index is the authority: the 2014
 * paladin and the 2024 paladin are `"1/2"` and `"artificer"` respectively, and
 * a table keyed by class id cannot say both.
 */
function legacyProgression(classId: string): CasterProgression | null {
  switch (getSpellProgressionForClass(classId)) {
    case "full":
      return "full";
    case "pact":
      return "pact";
    case "half":
      return normalizeClassId(classId) === "artificer" ? "artificer" : "1/2";
    default:
      return null;
  }
}
