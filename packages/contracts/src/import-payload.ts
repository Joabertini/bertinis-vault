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

import {
  abilityIdSchema,
  abilityScoreMapSchema,
  biographySchema,
  spellMethodSchema,
  spellPreparationSchema,
} from "./character-build.js";

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
   * How the spell sits on the sheet. Omitted for a cantrip, which dnd5e marks
   * prepared itself on creation and which no rule ever unprepares.
   */
  preparation: spellPreparationSchema.optional(),
  /**
   * How it is cast, where that is not the ordinary way.
   *
   * `innate` is the one that arrives: a species grants its spells cast once a
   * day without a slot, and importing one as an ordinary spell charges the
   * character a slot the rules never asked for.
   */
  method: spellMethodSchema.optional(),
  /** Casts before it comes back, and when. `period` is a dnd5e period key. */
  uses: z.object({ max: z.number().int().min(1), period: z.string().min(1) }).optional(),
  /**
   * The ability it is cast with, where the grant states one of its own.
   *
   * dnd5e keeps this on the spell as `system.ability` and prefers it over the
   * class's. Without it a fighter's species cantrip has no save DC, because a
   * fighter has no spellcasting ability to fall back on.
   */
  ability: abilityIdSchema.optional(),
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
 * A purse, in dnd5e's own five denominations.
 *
 * The actor keys them `pp`, `gp`, `ep`, `sp` and `cp` and stores whole coins,
 * so the payload carries coins rather than a total the module would have to
 * split — the split is a rule about which boxes a table reads, and it belongs
 * where both exporters can share it rather than in each of them.
 */
export const currencySchema = z.object({
  pp: z.number().int().min(0).default(0),
  gp: z.number().int().min(0).default(0),
  ep: z.number().int().min(0).default(0),
  sp: z.number().int().min(0).default(0),
  cp: z.number().int().min(0).default(0),
});

export type Currency = z.infer<typeof currencySchema>;

/**
 * Copper as coins: gold, silver and copper, and deliberately no further.
 *
 * The builder counts in copper because it is the only unit that never rounds.
 * The book says a 2024 fighter who takes the money instead of the kit walks
 * away with 150 gold pieces, so the sheet says 150 gp. Rolling that up into 15
 * platinum is the same money and a different answer: it puts the character's
 * whole purse in a box most tables never use, and the player has to convert it
 * back in their head to check it against what they were told they had.
 * Electrum is skipped for the same reason, and harder — almost no game uses it.
 */
export function coinsFromCopper(copper: number): Currency {
  const total = Math.max(Math.floor(copper), 0);

  return {
    pp: 0,
    gp: Math.floor(total / 100),
    ep: 0,
    sp: Math.floor((total % 100) / 10),
    cp: total % 10,
  };
}

/** What a purse is worth, in copper — every denomination, not only the three. */
export function copperFromCoins(coins: Partial<Currency>): number {
  return (
    (coins.pp ?? 0) * 1000 +
    (coins.gp ?? 0) * 100 +
    (coins.ep ?? 0) * 50 +
    (coins.sp ?? 0) * 10 +
    (coins.cp ?? 0)
  );
}

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
  /**
   * Tools whose proficiency is doubled.
   *
   * Separate from `expertise` because the actor keys them separately —
   * `system.tools` rather than `system.skills`, and with the ability the tool
   * rolls beside the value.
   */
  toolExpertise: z.array(z.string()).default([]),
  /**
   * Armour and weapon proficiencies, in dnd5e's own keys.
   *
   * These used to be left out, on the belief that they arrived with the class
   * and race documents Plutonium imports and that sending ours would fight
   * with them. Measured against an imported actor: `traits.armorProf.value`
   * and `traits.weaponProf.value` both came back empty. The class document
   * carries the grants as `Trait` advancements, and advancements only apply
   * when a character is levelled through them — which a direct import is
   * precisely not.
   *
   * `armor` holds `lgt`, `med`, `hvy`, `shl`. `weapons` holds `sim` and `mar`
   * plus base-item ids, both of which Foundry checks.
   */
  armor: z.array(z.string()).default([]),
  weapons: z.array(z.string()).default([]),
  /**
   * The weapons this character has mastery with, as dnd5e base-item ids.
   *
   * 2024's own idea, and the only one of these that is a *choice* rather than
   * a grant: five classes let the player name which weapons the feature
   * applies to, and it may be changed on a long rest.
   *
   * Foundry keeps it apart from the proficiency it sits beside —
   * `traits.weaponProf.mastery.value`, checked with `.has(baseItem)` against
   * the weapon's own id, never its name and never the mastery property.
   */
  masteries: z.array(z.string()).default([]),
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
  /**
   * The picture the player gave the character in the builder: a small data URL
   * (a 2:3 WebP or JPEG), so it travels in the same code as everything else.
   * The Foundry module stores it and makes it the actor's portrait and token.
   */
  portrait: z
    .string()
    .max(100_000)
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
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

  /**
   * The choices a class made the player answer as it levelled.
   *
   * Fighting styles, eldritch invocations, the pact boon, metamagic, maneuvers,
   * runes, arcane shots, elemental disciplines and artificer infusions are all
   * `optionalfeature` entities in 5etools, and all import the same way a feat
   * does. They are separate from `feats` because they are not feats: they are
   * answers to a question the class asked, and a class asks for a bounded
   * number of them.
   *
   * Defaulted rather than required, so a payload written before this existed
   * still reads.
   */
  optionalFeatures: z.array(z.object({ ref: vetoolsRefSchema })).default([]),
  spells: z.array(spellRefSchema).default([]),
  equipment: z.array(equipmentRefSchema).default([]),

  /**
   * The money the character starts with.
   *
   * Absent when they start with none, and absent from every payload written
   * before this field existed — which is why it is optional rather than
   * defaulted: a purse of five zeroes and no purse at all are the same thing,
   * and neither should overwrite what is already on an actor.
   */
  currency: currencySchema.optional(),

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
