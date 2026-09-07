/**
 * Accounts, and the characters an account keeps.
 *
 * The Codex has always lived in `localStorage`, which is not storage so much
 * as a cache the browser may throw away: a private window, a cleared site, a
 * different machine, a phone. A player who spent an evening building a party
 * had a file export and nothing else.
 *
 * What the server stores is the same thing the Codex stores, and it stores it
 * **opaquely**. A character is a builder state, the builder state changes every
 * time the builder learns a new question, and a server that validated its shape
 * would have to be redeployed in step with the front or start refusing
 * characters it has no opinion about. So the state crosses as JSON and comes
 * back as JSON; the front is the only thing that reads it.
 */

import { z } from "zod";

/** Who is signed in. Only what a page needs to greet them. */
export const accountSchema = z.object({
  id: z.string().min(1),
  /** The only provider today. Written down so a second one is a value, not a fork. */
  provider: z.literal("discord"),
  displayName: z.string().min(1).max(120),
  avatarUrl: z.string().url().nullable().default(null),
});

export type Account = z.infer<typeof accountSchema>;

/**
 * A character as it is stored, with the state left unread.
 *
 * `sealedAt` is the version marker as well as the date: sealing a character
 * again writes a fresh one, so the later of two copies is the later edit. It
 * is compared as a string, which is correct for ISO timestamps and gives an
 * entry with no date the loss it should have.
 */
/**
 * The code a character is published under, and the secret that keeps it.
 *
 * Kept beside the state rather than inside it, and the reason is not tidiness:
 * the state is sent to the build store on every publish and handed back to
 * anyone who opens the code. A write token in there would be printed on the
 * thing it is meant to protect.
 *
 * Both are optional because a character only has them once it has been shared
 * at least once, and most never are.
 */
export const characterShareSchema = z.object({
  code: z.string().min(1).max(24),
  /** Never leaves the owner's own Codex and account. See `handler.ts`. */
  writeToken: z.string().min(1).max(64),
});

export type CharacterShare = z.infer<typeof characterShareSchema>;

export const storedCharacterSchema = z.object({
  id: z.string().min(1).max(64),
  sealedAt: z.string().max(40),
  state: z.record(z.unknown()),
  /**
   * Synced so a character keeps one code across machines.
   *
   * Without this, signing in on a phone and sharing the same character there
   * would mint a second code for it — and the first one, the one written on
   * somebody's sheet, would quietly stop being the current version.
   */
  share: characterShareSchema.optional(),
});

export type StoredCharacter = z.infer<typeof storedCharacterSchema>;

/**
 * How many characters an account keeps, and how large one may be.
 *
 * A level 20 character with every spell and a full pack is about 11KB as a
 * payload and less as a draft, so 128KB is far more than a character and far
 * less than an upload.
 */
export const MAX_CHARACTERS_PER_ACCOUNT = 200;
export const MAX_CHARACTER_BYTES = 128 * 1024;

export const syncRequestSchema = z.object({
  characters: z.array(storedCharacterSchema).max(MAX_CHARACTERS_PER_ACCOUNT),
  /**
   * Characters the player burned on this machine, by id.
   *
   * Without this, deleting a character and syncing would hand it straight back
   * from the server — the merge only ever adds. A deletion is the one thing a
   * newest-wins merge cannot express, so it is said out loud.
   */
  burned: z.array(z.string().min(1).max(64)).max(MAX_CHARACTERS_PER_ACCOUNT).default([]),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export type MergeResult<T> = {
  characters: T[];
  /** Characters the receiving side did not have. */
  added: number;
  /** Characters the other side had a newer copy of. */
  updated: number;
  /** Characters the receiving side already had a newer copy of, and kept. */
  kept: number;
};

/**
 * Fold one list of characters into another, newest wins.
 *
 * Merged, never replaced. Signing in on a second machine must not delete the
 * character built on the first, and the common case — carrying a Codex
 * somewhere else — is one where both sides have real work in them.
 *
 * Where both have the same character, the one sealed later wins. It is the
 * only rule that cannot lose an edit: taking the incoming copy always would
 * undo work done since, and keeping the local one always would make syncing an
 * updated character do nothing at all.
 *
 * The same function runs in the browser and in the Worker, because a merge
 * rule that exists twice is a merge rule that will disagree with itself.
 */
export function mergeByNewest<T extends { id: string; sealedAt: string }>(
  existing: T[],
  incoming: T[],
): MergeResult<T> {
  const merged = [...existing];
  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const character of incoming) {
    const at = merged.findIndex((entry) => entry.id === character.id);

    if (at < 0) {
      merged.push(character);
      added += 1;
      continue;
    }

    if (character.sealedAt > (merged[at]?.sealedAt ?? "")) {
      merged[at] = character;
      updated += 1;
    } else {
      kept += 1;
    }
  }

  // Newest first, the way the Codex already reads.
  merged.sort((left, right) => right.sealedAt.localeCompare(left.sealedAt));

  return { characters: merged, added, updated, kept };
}
