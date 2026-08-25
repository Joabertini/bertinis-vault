import { z } from "zod";

/**
 * The ruleset a build targets.
 *
 * It decides which books are legal, and therefore which document a pick
 * resolves to: most entities exist in both editions under different sources
 * and different hashes, so the same name imports as a different thing.
 */
export const rulesVersionSchema = z.enum(["5e-2014", "5e-2024"]);
export const sourceProfileSchema = z.literal("vault-v1");
export const canonicalIdSchema = z.string().trim().min(1);
export const canonicalLabelSchema = z.string().trim().min(1);
export const isoDateTimeSchema = z.string().datetime();

export const abilityIdSchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type AbilityId = z.infer<typeof abilityIdSchema>;

export const abilityScoreMapSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

export const generationMethodSchema = z.enum([
  "roll",
  "standard-array",
  "point-buy",
  "manual",
]);

export const biographySchema = z.object({
  trait: canonicalLabelSchema.optional(),
  ideal: canonicalLabelSchema.optional(),
  bond: canonicalLabelSchema.optional(),
  flaw: canonicalLabelSchema.optional(),
  notes: canonicalLabelSchema.optional(),
});

export const characterMetaSchema = z.object({
  rulesVersion: rulesVersionSchema,
  sourceProfile: sourceProfileSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const identitySchema = z.object({
  characterName: canonicalLabelSchema,
  playerName: canonicalLabelSchema.optional(),
  alignment: canonicalLabelSchema.optional(),
  biography: biographySchema.optional(),
});

export const ancestrySchema = z.object({
  raceId: canonicalIdSchema,
  subraceId: canonicalIdSchema.optional(),
});

export const classEntrySchema = z.object({
  classId: canonicalIdSchema,
  subclassId: canonicalIdSchema.optional(),
  level: z.number().int().min(1).max(20),
});

export const classingSchema = z.object({
  classes: z.array(classEntrySchema).min(1),
});

export const backgroundSchema = z.object({
  backgroundId: canonicalIdSchema,
  grantedFeatIds: z.array(canonicalIdSchema).default([]),
});

export const abilitiesSchema = z.object({
  generationMethod: generationMethodSchema,
  rolledSets: z.array(z.array(z.number().int().min(1).max(30)).length(6)).optional(),
  base: abilityScoreMapSchema,
  final: abilityScoreMapSchema,
});

export const normalizedProficiencyKindSchema = z.enum([
  "skill",
  "language",
  "tool",
  "savingThrow",
  "weapon",
  "armor",
  "other",
]);

export const normalizedFeatureSourceSchema = z.enum([
  "class",
  "subclass",
  "background",
  "feat",
  "race",
  "other",
]);

export const normalizedEquipmentCategorySchema = z.enum([
  "weapon",
  "armor",
  "shield",
  "gear",
  "other",
]);

export const normalizedProficiencyEntrySchema = z.object({
  kind: normalizedProficiencyKindSchema,
  id: canonicalIdSchema.optional(),
  label: canonicalLabelSchema,
});

export const normalizedSpellEntrySchema = z.object({
  spellId: canonicalIdSchema.optional(),
  label: canonicalLabelSchema,
  level: z.number().int().min(0).max(9),
});

export const normalizedEquipmentEntrySchema = z.object({
  itemId: canonicalIdSchema.optional(),
  label: canonicalLabelSchema,
  quantity: z.number().int().min(1).default(1),
  category: normalizedEquipmentCategorySchema.default("other"),
  /**
   * How this armour computes armour class, e.g. `"14+DEX2"`.
   *
   * Present when the armour came from the index, which carries a base AC for
   * every armour in the game. Without it the rules layer falls back to its own
   * catalog, which knows five.
   */
  armorFormula: z.string().min(1).optional(),
  /** Whether this counts as a shield, which stacks its bonus on the formula. */
  grantsShieldBonus: z.boolean().optional(),
});

export const normalizedFeatureEntrySchema = z.object({
  featureId: canonicalIdSchema.optional(),
  label: canonicalLabelSchema,
  source: normalizedFeatureSourceSchema.default("other"),
});

export const normalizedChoicesSchema = z.object({
  feats: z.array(canonicalIdSchema).default([]),
  proficiencies: z.array(normalizedProficiencyEntrySchema).default([]),
  spells: z.array(normalizedSpellEntrySchema).default([]),
  equipment: z.array(normalizedEquipmentEntrySchema).default([]),
  features: z.array(normalizedFeatureEntrySchema).default([]),
});

export const choicesSchema = z.object({
  feats: z.array(canonicalIdSchema).default([]),
  /**
   * Level-up picks: fighting styles, invocations, metamagic, maneuvers.
   *
   * Kept apart from `feats` because a class grants a bounded number of them
   * from a named pool, which is a different question from "spend an ability
   * score improvement on a feat instead".
   */
  optionalFeatures: z.array(canonicalIdSchema).default([]),
  proficiencies: z.array(canonicalLabelSchema).default([]),
  spells: z.array(canonicalLabelSchema).default([]),
  equipment: z.array(canonicalLabelSchema).default([]),
  features: z.array(canonicalLabelSchema).default([]),
  normalized: normalizedChoicesSchema.optional(),
});

export const spellcastingSchema = z.object({
  ability: abilityIdSchema,
  attackBonus: z.number().int(),
  saveDC: z.number().int(),
  /**
   * Slots by the level they are, e.g. `{"1": 4, "2": 3}`.
   *
   * Not Foundry's field names: the module turns a level into a field on
   * arrival, and sending it a field name made it build one twice.
   * A warlock's are under `pact`, which is a separate resource on the sheet.
   */
  slots: z.record(z.string(), z.number().int().min(0)),
  /** The level a warlock's pact slots are cast at. Absent for everyone else. */
  pactLevel: z.number().int().min(1).max(9).optional(),
});

export const derivedSchema = z.object({
  proficiencyBonus: z.number().int().min(2).max(6),
  hp: z.number().int().min(1),
  ac: z.number().int().min(1),
  spellcasting: spellcastingSchema.optional(),
});

/**
 * Which book each pick came from, keyed by `"<prop>:<id>"`.
 *
 * A build identifies everything by slug, and a slug does not say which book
 * the entity came from. Most of the time that is enough. It is not enough for
 * the 25 races whose name appears in more than one book legal for the same
 * edition: resolving those by name alone is ambiguous, and the resolver
 * refuses rather than guessing.
 *
 * A side table rather than a field on every pick, so that adding it changes
 * no existing shape. Absent means "resolve by name", which is what every build
 * written before this did.
 */
export const sourceBooksSchema = z.record(z.string(), z.string());

export const characterBuildInputSchema = z.object({
  meta: characterMetaSchema,
  identity: identitySchema,
  ancestry: ancestrySchema,
  classing: classingSchema,
  background: backgroundSchema,
  abilities: abilitiesSchema,
  choices: choicesSchema,
  sourceBooks: sourceBooksSchema.optional(),
});

export const characterBuildSchema = characterBuildInputSchema.extend({
  derived: derivedSchema,
});

export type AbilityScoreMap = z.infer<typeof abilityScoreMapSchema>;
export type Biography = z.infer<typeof biographySchema>;
export type CharacterMeta = z.infer<typeof characterMetaSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Ancestry = z.infer<typeof ancestrySchema>;
export type ClassEntry = z.infer<typeof classEntrySchema>;
export type Classing = z.infer<typeof classingSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type Abilities = z.infer<typeof abilitiesSchema>;
export type NormalizedProficiencyEntry = z.infer<typeof normalizedProficiencyEntrySchema>;
export type NormalizedSpellEntry = z.infer<typeof normalizedSpellEntrySchema>;
export type NormalizedEquipmentEntry = z.infer<typeof normalizedEquipmentEntrySchema>;
export type NormalizedFeatureEntry = z.infer<typeof normalizedFeatureEntrySchema>;
export type NormalizedChoices = z.infer<typeof normalizedChoicesSchema>;
export type Choices = z.infer<typeof choicesSchema>;
export type SourceBooks = z.infer<typeof sourceBooksSchema>;
export type Spellcasting = z.infer<typeof spellcastingSchema>;
export type Derived = z.infer<typeof derivedSchema>;
export type CharacterBuildInput = z.infer<typeof characterBuildInputSchema>;
export type CharacterBuild = z.infer<typeof characterBuildSchema>;
