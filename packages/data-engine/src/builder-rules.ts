export type ClassFallbackMeta = {
  hitDie: number;
  spellcastingAbility: string | null;
  casterProgression: string;
  startingEquipment: string[];
  primaryAbilities: string[];
};

export const classFallbackMetaById: Record<string, ClassFallbackMeta> = {
  artificer: { hitDie: 8, spellcastingAbility: "int", casterProgression: "half", startingEquipment: ["leather", "dagger", "thieves-tools", "explorers-pack"], primaryAbilities: ["int", "con"] },
  bard: { hitDie: 8, spellcastingAbility: "cha", casterProgression: "full", startingEquipment: ["dagger", "component-pouch", "lute", "explorers-pack"], primaryAbilities: ["cha", "dex"] },
  cleric: { hitDie: 8, spellcastingAbility: "wis", casterProgression: "full", startingEquipment: ["mace", "shield", "holy-symbol", "priests-pack"], primaryAbilities: ["wis", "str"] },
  druid: { hitDie: 8, spellcastingAbility: "wis", casterProgression: "full", startingEquipment: ["quarterstaff", "leather", "explorers-pack", "druidic-focus"], primaryAbilities: ["wis", "con"] },
  fighter: { hitDie: 10, spellcastingAbility: null, casterProgression: "none", startingEquipment: ["chain-mail", "longsword", "shield", "dungeoneers-pack"], primaryAbilities: ["str", "con"] },
  monk: { hitDie: 8, spellcastingAbility: null, casterProgression: "none", startingEquipment: ["quarterstaff", "dart", "explorers-pack"], primaryAbilities: ["dex", "wis"] },
  paladin: { hitDie: 10, spellcastingAbility: "cha", casterProgression: "half", startingEquipment: ["chain-mail", "shield", "longsword", "holy-symbol"], primaryAbilities: ["str", "cha"] },
  ranger: { hitDie: 10, spellcastingAbility: "wis", casterProgression: "half", startingEquipment: ["leather", "shortbow", "dagger", "explorers-pack"], primaryAbilities: ["dex", "wis"] },
  rogue: { hitDie: 8, spellcastingAbility: null, casterProgression: "none", startingEquipment: ["dagger", "thieves-tools", "leather", "dungeoneers-pack"], primaryAbilities: ["dex", "int"] },
  sorcerer: { hitDie: 6, spellcastingAbility: "cha", casterProgression: "full", startingEquipment: ["dagger", "arcane-focus", "component-pouch", "dungeoneers-pack"], primaryAbilities: ["cha", "con"] },
  warlock: { hitDie: 8, spellcastingAbility: "cha", casterProgression: "pact", startingEquipment: ["dagger", "leather", "arcane-focus", "scholars-pack"], primaryAbilities: ["cha", "con"] },
  wizard: { hitDie: 6, spellcastingAbility: "int", casterProgression: "full", startingEquipment: ["quarterstaff", "spellbook", "component-pouch", "scholars-pack"], primaryAbilities: ["int", "con"] },
};

export function getClassFallbackMeta(classId: string): ClassFallbackMeta | undefined {
  return classFallbackMetaById[classId];
}
