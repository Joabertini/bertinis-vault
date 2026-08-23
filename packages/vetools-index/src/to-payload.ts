/**
 * Turning a build into the payload that travels under a code.
 *
 * This is where item fabrication ends. Every pick becomes a reference or a
 * reported failure; nothing is invented, and nothing is quietly dropped.
 *
 * The conversion never throws on a pick it cannot resolve. A character with one
 * unresolvable spell is still worth exporting — the player needs to see which
 * pick is the problem, not a stack trace.
 */

import type {
  CharacterBuild,
  ImportPayload,
  PayloadRulesVersion,
  SourceBooks,
  VetoolsRefPayload,
} from "@bertinis-vault/contracts";
import { IMPORT_PAYLOAD_VERSION } from "@bertinis-vault/contracts";
import type { RulesVersion, VetoolsProp } from "@bertinis-vault/vetools-ref";

import type { RefResolver, ResolutionFailure } from "./resolve.js";

export type BuildConversion = {
  /** Null when a reference the payload requires could not be resolved. */
  payload: ImportPayload | null;
  /** Every pick that failed, in the order they appear in the build. */
  failures: ResolutionFailure[];
};

/**
 * The rules version a build targets.
 *
 * `CharacterBuild.meta.rulesVersion` is the string `"5e-2014"`; the payload
 * uses `"2014"`. Kept as a function so the 2024 case has somewhere to land when
 * the contract grows to express it.
 */
export function rulesVersionFromMeta(meta: CharacterBuild["meta"]): PayloadRulesVersion {
  return meta.rulesVersion === "5e-2014" ? "2014" : "2024";
}

/** The key a build files a pick's book under. */
export function sourceBookKey(prop: VetoolsProp, id: string): string {
  return `${prop}:${id}`;
}

/** Resolve one pick, recording the failure rather than raising it. */
function tryResolve(
  resolver: RefResolver,
  prop: VetoolsProp,
  query: string | undefined,
  failures: ResolutionFailure[],
  sourceBooks?: SourceBooks,
): VetoolsRefPayload | null {
  if (!query) return null;

  const result = resolver.resolve(prop, query, sourceBooks?.[sourceBookKey(prop, query)]);
  if (result.ok) return result.value;

  failures.push(result.failure);
  return null;
}

/**
 * Convert a canonical build into a payload.
 *
 * The race, every class, and the background are required: a payload without
 * them is not a character, so failing to resolve any of them yields a null
 * payload alongside the failures explaining why.
 *
 * Spells, equipment and feats are best-effort. One unresolvable spell should
 * not stop the other forty from exporting.
 */
export function buildToPayload(build: CharacterBuild, resolver: RefResolver): BuildConversion {
  const failures: ResolutionFailure[] = [];
  const normalized = build.choices.normalized;
  const books = build.sourceBooks;

  const raceRef = tryResolve(resolver, "race", build.ancestry.raceId, failures, books);
  const subraceRef = tryResolve(resolver, "race", build.ancestry.subraceId, failures, books);
  const backgroundRef = tryResolve(resolver, "background", build.background.backgroundId, failures, books);

  const classes = build.classing.classes.map((entry) => {
    const ref = tryResolve(resolver, "class", entry.classId, failures, books);
    const subclass = tryResolve(resolver, "subclass", entry.subclassId, failures, books);
    return ref ? { ref, level: entry.level, ...(subclass ? { subclass } : {}) } : null;
  });

  const feats = [...build.background.grantedFeatIds, ...build.choices.feats]
    .map((featId) => tryResolve(resolver, "feat", featId, failures, books))
    .filter((ref): ref is VetoolsRefPayload => ref !== null)
    .map((ref) => ({ ref }));

  const spells = (normalized?.spells ?? [])
    .map((entry) => {
      const ref = tryResolve(resolver, "spell", entry.spellId ?? entry.label, failures, books);
      return ref ? { ref } : null;
    })
    .filter((entry): entry is { ref: VetoolsRefPayload } => entry !== null);

  const equipment = (normalized?.equipment ?? [])
    .map((entry) => {
      const ref = tryResolve(resolver, "item", entry.itemId ?? entry.label, failures, books);
      return ref ? { ref, quantity: entry.quantity } : null;
    })
    .filter((entry): entry is { ref: VetoolsRefPayload; quantity: number } => entry !== null);

  const resolvedClasses = classes.filter(
    (entry): entry is NonNullable<(typeof classes)[number]> => entry !== null,
  );

  if (!raceRef || !backgroundRef || resolvedClasses.length === 0) {
    return { payload: null, failures };
  }

  const payload: ImportPayload = {
    version: IMPORT_PAYLOAD_VERSION,
    rulesVersion: rulesVersionFromMeta(build.meta),
    exportedAt: new Date().toISOString(),
    identity: {
      characterName: build.identity.characterName,
      ...(build.identity.playerName ? { playerName: build.identity.playerName } : {}),
      ...(build.identity.alignment ? { alignment: build.identity.alignment } : {}),
      ...(build.identity.biography ? { biography: build.identity.biography } : {}),
    },
    race: { ref: raceRef, ...(subraceRef ? { subrace: subraceRef } : {}) },
    classes: resolvedClasses,
    background: { ref: backgroundRef },
    abilities: build.abilities.final,
    proficiencies: partitionProficiencies(normalized?.proficiencies ?? []),
    feats,
    spells,
    equipment,
    derived: {
      hp: build.derived.hp,
      ac: build.derived.ac,
      proficiencyBonus: build.derived.proficiencyBonus,
      ...(build.derived.spellcasting ? { spellcasting: build.derived.spellcasting } : {}),
    },
  };

  return { payload, failures };
}

/**
 * Split proficiencies by kind.
 *
 * These are picks from a list rather than entities, so they travel as labels
 * the module writes onto the actor. Weapon and armour proficiencies are
 * omitted: they come from the class and race documents Plutonium imports, and
 * sending our own would fight with them.
 */
function partitionProficiencies(
  entries: NonNullable<CharacterBuild["choices"]["normalized"]>["proficiencies"],
): ImportPayload["proficiencies"] {
  const result: ImportPayload["proficiencies"] = {
    skills: [],
    languages: [],
    tools: [],
    savingThrows: [],
    expertise: [],
  };

  for (const entry of entries) {
    const value = entry.id ?? entry.label;
    if (entry.kind === "skill") result.skills.push(value);
    else if (entry.kind === "language") result.languages.push(value);
    else if (entry.kind === "tool") result.tools.push(value);
  }

  return result;
}

/** A short, human-readable account of what failed, for the builder to show. */
export function describeFailure(failure: ResolutionFailure): string {
  switch (failure.reason) {
    case "wrong-edition":
      return `"${failure.query}" is not part of this ruleset. It exists in ${failure.availableIn?.join(", ")}.`;
    case "ambiguous":
      return `"${failure.query}" appears in ${failure.availableIn?.join(", ")}. Pick which one.`;
    case "not-found":
      return `"${failure.query}" was not found.`;
  }
}

/** Build a resolver for the ruleset a build targets. */
export function rulesVersionOfBuild(build: CharacterBuild): RulesVersion {
  return rulesVersionFromMeta(build.meta) === "2014" ? "2014" : "2024";
}
