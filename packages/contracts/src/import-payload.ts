/**
 * The payload a build travels as.
 *
 * This is the contract between the web builder and the Foundry module. It
 * crosses a network, is stored under a short code, and is read by a module the
 * player may not have updated, so it is versioned and self-contained.
 *
 * It carries references, never entity bodies. Plutonium resolves each
 * `{page, source, hash}` into the real `dnd5e` document; anything we could
 * fabricate ourselves would be worse than what it returns.
 *
 * What remains here is only what Plutonium cannot know: who the character is,
 * their ability scores, and which of the choices a build offers were taken.
 */

import { z } from "zod";

import { abilityIdSchema, abilityScoreMapSchema, biographySchema } from "./character-build.js";

/** Bumped when the module can no longer read an older payload. */
export const IMPORT_PAYLOAD_VERSION = 1;

export const payloadRulesVersionSchema = z.enum(["2014", "2024"]);
export type PayloadRulesVersion = z.infer<typeof payloadRulesVersionSchema>;

/**
 * A 5etools reference.
 *
 * Mirrors `VetoolsRef` from `@bertinis-vault/vetools-ref`, declared here as a
 * schema so a payload arriving over the wire can be validated without trusting
 * the sender.
 */
export const vetoolsRefSchema = z.object({
  /** The 5etools page, e.g. `spells.html`. */
  page: z.string().min(1),
  /** The book code, e.g. `PHB`. */
  source: z.string().min(1),
  /** The 5etools URL hash. */
  hash: z.string().min(1),
  /** The prop, so the module can pick an importer without reversing the page. */
  prop: z.string().min(1),
});

export type VetoolsRefPayload = z.infer<typeof vetoolsRefSchema>;

export const classRefSchema = z.object({
  ref: vetoolsRefSchema,
  level: z.number().int().min(1).max(20),
  /** Absent below the level a class chooses its subclass. */
  subclass: vetoolsRefSchema.optional(),
});

export const spellRefSchema = z.object({
  ref: vetoolsRefSchema,
  /**
   * Whether the spell is prepared. Meaningless for classes that know their
   * spells, so it is optional rather than defaulted.
   */
  prepared: z.boolean().optional(),
  /** Set when a feature grants the spell outside the class list. */
  grantedBy: z.string().optional(),
});

export const equipmentRefSchema = z.object({
  ref: vetoolsRefSchema,
  quantity: z.number().int().min(1).default(1),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
});

/**
 * Choices with no entity behind them.
 *
 * Skills, languages and tool proficiencies are picked from lists rather than
 * imported as documents, so they travel as identifiers the module writes onto
 * the actor directly.
 */
export const proficiencyChoicesSchema = z.object({
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  savingThrows: z.array(abilityIdSchema).default([]),
  expertise: z.array(z.string()).default([]),
});

/**
 * Values the module writes rather than recomputes.
 *
 * The builder owns the rules, so it owns the results. Recomputing them inside
 * Foundry would mean maintaining the same rules twice and drifting.
 */
export const payloadDerivedSchema = z.object({
  hp: z.number().int().min(1),
  ac: z.number().int().min(1),
  proficiencyBonus: z.number().int().min(2).max(6),
  speed: z.number().int().min(0).optional(),
  initiative: z.number().int().optional(),
  spellcasting: z
    .object({
      ability: abilityIdSchema,
      attackBonus: z.number().int(),
      saveDC: z.number().int(),
      /**
       * Slots by the level they are, e.g. `{"1": 4, "2": 3}`. A warlock's are
       * under `pact` instead, and `pactLevel` says what level they cast at.
       */
      slots: z.record(z.string(), z.number().int().min(0)),
      pactLevel: z.number().int().min(1).max(9).optional(),
    })
    .optional(),
});

export const payloadIdentitySchema = z.object({
  characterName: z.string().trim().min(1).max(120),
  playerName: z.string().trim().max(120).optional(),
  alignment: z.string().trim().max(60).optional(),
  biography: biographySchema.optional(),
});

export const importPayloadSchema = z.object({
  /** Payload format, not the character's ruleset. */
  version: z.literal(IMPORT_PAYLOAD_VERSION),
  /** Which edition the character was built against. */
  rulesVersion: payloadRulesVersionSchema,
  /** When the build was exported. */
  exportedAt: z.string().datetime(),

  identity: payloadIdentitySchema,

  race: z.object({
    ref: vetoolsRefSchema,
    subrace: vetoolsRefSchema.optional(),
  }),
  classes: z.array(classRefSchema).min(1).max(20),
  background: z.object({ ref: vetoolsRefSchema }),

  abilities: abilityScoreMapSchema,
  proficiencies: proficiencyChoicesSchema,

  feats: z.array(z.object({ ref: vetoolsRefSchema })).default([]),
  spells: z.array(spellRefSchema).default([]),
  equipment: z.array(equipmentRefSchema).default([]),

  derived: payloadDerivedSchema,
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type ClassRef = z.infer<typeof classRefSchema>;
export type SpellRef = z.infer<typeof spellRefSchema>;
export type EquipmentRef = z.infer<typeof equipmentRefSchema>;
export type ProficiencyChoices = z.infer<typeof proficiencyChoicesSchema>;
export type PayloadDerived = z.infer<typeof payloadDerivedSchema>;

/** Every reference a payload contains, in import order. */
export function collectRefs(payload: ImportPayload): VetoolsRefPayload[] {
  const refs: VetoolsRefPayload[] = [payload.race.ref];
  if (payload.race.subrace) refs.push(payload.race.subrace);

  for (const entry of payload.classes) {
    refs.push(entry.ref);
    if (entry.subclass) refs.push(entry.subclass);
  }

  refs.push(payload.background.ref);
  for (const feat of payload.feats) refs.push(feat.ref);
  for (const spell of payload.spells) refs.push(spell.ref);
  for (const item of payload.equipment) refs.push(item.ref);

  return refs;
}

/** The character's total level across all classes. */
export function totalLevel(payload: ImportPayload): number {
  return payload.classes.reduce((sum, entry) => sum + entry.level, 0);
}

export class PayloadVersionError extends Error {
  constructor(
    readonly received: unknown,
    readonly expected: number = IMPORT_PAYLOAD_VERSION,
  ) {
    super(
      `This build was exported in payload format ${String(received)}, but this module reads format ${expected}. Update the module.`,
    );
    this.name = "PayloadVersionError";
  }
}

/**
 * Parse a payload received over the wire.
 *
 * A version mismatch is reported on its own, because "update the module" is
 * actionable and a wall of schema errors is not.
 */
export function parseImportPayload(input: unknown): ImportPayload {
  if (
    typeof input === "object" &&
    input !== null &&
    "version" in input &&
    (input as { version: unknown }).version !== IMPORT_PAYLOAD_VERSION
  ) {
    throw new PayloadVersionError((input as { version: unknown }).version);
  }

  return importPayloadSchema.parse(input);
}
