/**
 * The 2024 fighting style: a feat the class hands over, not an optional feature.
 *
 * In 2014 a style is an `optionalfeature` and the class's own progression asks
 * for it (see `optional-features.ts`). XPHB moved the styles into the feat list
 * — category FS, prerequisite "Fighting Style feature" — and dropped them from
 * the progression, so nothing asked for them and every 2024 martial left the
 * Forge without one.
 *
 * Which levels hand one out is not in the index, so it is written here, from the
 * class pages: fighter 1, paladin 2, ranger 2, and the champion's Additional
 * Fighting Style at 7. The paladin and the ranger may take their class's own
 * alternative (Blessed Warrior, Druidic Warrior) in its place.
 *
 * The answers live in `styleFeatIds`, keyed by grant, and are asked as talent
 * pools whose option ids are `style:<class>:<level>|<feat>` — the class chamber
 * already draws pools, and one id per grant keeps the champion's two questions
 * apart.
 */

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";

import type { BuilderState } from "./builder-state";
import { classEntriesFor } from "./classing";
import { slugOf } from "./index-options";
import { levelFeatsFor } from "./level-choices";
import type { TalentPool } from "./optional-features";

type Grant = { classId: string; subclassId?: string; level: number; alternative?: string };

const GRANTS: Grant[] = [
  { classId: "fighter", level: 1 },
  { classId: "paladin", level: 2, alternative: "blessed-warrior" },
  { classId: "ranger", level: 2, alternative: "druidic-warrior" },
  { classId: "fighter", subclassId: "champion", level: 7 },
];

type FeatRow = { name: string; source: string; prerequisites?: Array<{ features?: string[] }> };

const STYLE_PREFIX = "style:";

/** The style grants this draft has reached, each with its key. */
export function styleGrantsFor(state: BuilderState) {
  if (state.rulesVersion !== "5e-2024" || !state.classId) return [];
  const entries = classEntriesFor(
    { classId: state.classId, subclassId: state.subclassId, level: state.level },
    state.extraClasses,
    "2024",
  );
  return GRANTS.flatMap((grant) => {
    const entry = entries.find(
      (candidate) =>
        candidate.classId === grant.classId &&
        candidate.level >= grant.level &&
        (!grant.subclassId || candidate.subclassId === grant.subclassId),
    );
    return entry ? [{ ...grant, key: `${grant.classId}:${grant.level}` }] : [];
  });
}

/** The style feats chosen for the grants reached. */
export function styleFeatIdsFor(state: BuilderState): string[] {
  return styleGrantsFor(state).flatMap((grant) => {
    const featId = state.styleFeatIds?.[grant.key];
    return featId ? [featId] : [];
  });
}

function styleFeats(): Array<{ id: string; label: string; source: string }> {
  return (forRulesVersion(collections.feat ?? [], "2024") as FeatRow[])
    .filter((row) => row.prerequisites?.some((prerequisite) => prerequisite.features?.includes("Fighting Style")))
    .map((row) => ({ id: slugOf(row.name), label: row.name, source: row.source }));
}

function featRow(id: string) {
  const row = (forRulesVersion(collections.feat ?? [], "2024") as FeatRow[]).find((entry) => slugOf(entry.name) === id);
  return row ? { id, label: row.name, source: row.source } : null;
}

/** One pool per grant reached: choose one feat. */
export function stylePoolsFor(state: BuilderState): TalentPool[] {
  const grants = styleGrantsFor(state);
  const feats = styleFeats();
  return grants.map((grant) => {
    // A feat is taken once: the other style grant and a level or species pick both use it up.
    const takenElsewhere = new Set([
      ...grants.filter((other) => other.key !== grant.key).flatMap((other) => state.styleFeatIds?.[other.key] ?? []),
      ...levelFeatsFor(state),
      state.featId,
    ]);
    const alternative = grant.alternative ? featRow(grant.alternative) : null;
    return {
      name: grant.subclassId ? "Fighting Style (Additional)" : "Fighting Style",
      count: 1,
      options: [...feats, ...(alternative ? [alternative] : [])].map((feat) => ({
        id: `${STYLE_PREFIX}${grant.key}|${feat.id}`,
        label: feat.label,
        source: feat.source,
        notes: [],
        eligible: !takenElsewhere.has(feat.id),
        ...(takenElsewhere.has(feat.id) ? { blockedBy: "Ya tenés esa dote" } : {}),
      })),
    };
  });
}

/** The pool ids standing for the answers given, for the pools to count. */
export function styleTalentIdsFor(state: BuilderState): string[] {
  return styleGrantsFor(state).flatMap((grant) => {
    const featId = state.styleFeatIds?.[grant.key];
    return featId ? [`${STYLE_PREFIX}${grant.key}|${featId}`] : [];
  });
}

/** A toggle on a style option: the grant's answer, or null if the id is not one. */
export function styleToggle(state: BuilderState, id: string): Record<string, string> | null {
  if (!id.startsWith(STYLE_PREFIX)) return null;
  const [key, featId] = id.slice(STYLE_PREFIX.length).split("|");
  if (!key || !featId) return null;
  const next = { ...(state.styleFeatIds ?? {}) };
  if (next[key] === featId) delete next[key];
  else next[key] = featId;
  return next;
}
