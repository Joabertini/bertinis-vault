/**
 * How suspicious a new Discord account looks, said as a number and the reasons behind it.
 *
 * Signing in is required to publish (#200), and an account is cheap to make. This is the cheap check at
 * the door: a handful of things Discord already tells us about an account, each adding a few points, and a
 * threshold above which a first registration is held for a person to look at instead of waved through.
 *
 * What it can and cannot see. With only the `identify` scope Discord gives the id, the handle, the avatar
 * and some flags. It does not say whether the account has been reported, and this does not pretend to: a
 * report count would be one more signal here, from this site's own record, and is not part of this change.
 *
 * A score is a reason to look, never a verdict. A legitimate player with a new account scores low and
 * passes; the ones that reach the threshold are asked to say who they are (the appeal), not banned.
 *
 * Deliberately a pure function of what it is given, so the thresholds can be tested and argued about
 * without a Discord in the room.
 */

/** Discord's epoch (2015-01-01) in milliseconds, the origin of every snowflake id. */
const DISCORD_EPOCH = 1420070400000n;

const DAY_MS = 24 * 60 * 60 * 1000;

export type Signals = {
  /** The Discord user id, a snowflake. The moment the account was created is inside it. */
  id: string;
  /** The handle (not the display name), which is what bot farms generate in bulk. */
  username: string;
  /** True when the account never chose an avatar. */
  defaultAvatar: boolean;
  bot: boolean;
};

export type Assessment = {
  score: number;
  /** Plain Spanish, for whoever reads the appeal. */
  reasons: string[];
};

/** When the account was created, read out of its id; null when the id is not a snowflake. */
export function createdAtOf(id: string): Date | null {
  if (!/^\d{15,22}$/.test(id)) return null;

  try {
    return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
  } catch {
    return null;
  }
}

/** Points for how recently the account was made. The younger, the more. */
function ageScore(ageDays: number): { points: number; reason: string } | null {
  if (ageDays < 7) return { points: 4, reason: "cuenta creada hace menos de una semana" };
  if (ageDays < 30) return { points: 3, reason: "cuenta creada hace menos de un mes" };
  if (ageDays < 180) return { points: 2, reason: "cuenta creada hace menos de seis meses" };
  if (ageDays < 365) return { points: 1, reason: "cuenta creada hace menos de un año" };
  return null;
}

export function assess(signals: Signals, now: Date = new Date()): Assessment {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (signals.bot) add(100, "la cuenta es un bot");

  const created = createdAtOf(signals.id);
  if (created) {
    const age = ageScore((now.getTime() - created.getTime()) / DAY_MS);
    if (age) add(age.points, age.reason);
  } else {
    // An id that is not a snowflake is not something Discord hands out.
    add(2, "el id no tiene la forma de un id de Discord");
  }

  if (signals.defaultAvatar) add(1, "sin avatar propio");

  // A handle that ends in a run of digits is how generated names look: `adjective_noun48213`.
  if (/\d{4,}$/.test(signals.username)) add(1, "usuario terminado en una tira de números");

  return { score, reasons };
}

/** The score at which a first registration is held. Five unless the deployment says otherwise. */
export const DEFAULT_DENY_AT = 5;

export function denyThresholdOf(raw: string | undefined): number {
  const given = Number(raw);
  return Number.isFinite(given) && given > 0 ? given : DEFAULT_DENY_AT;
}

/** The ids a deployment refuses outright, from a comma-separated list. */
export function blockedIdsOf(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}
