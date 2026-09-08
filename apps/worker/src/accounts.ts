/**
 * The slice of the database this Worker uses, and the D1 implementation of it.
 *
 * Declared as an interface first for the same reason `BuildStore` is: the
 * handler is written against web standards so it can be exercised with plain
 * Requests, and a handler that spoke D1's prepare-and-bind vocabulary could
 * only be tested by reimplementing D1.
 */

import type { StoredCharacter } from "@bertinis-vault/contracts";

export type AccountRecord = {
  id: string;
  provider: string;
  providerId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type Store = {
  /**
   * The account for this provider identity, created if this is their first
   * visit and refreshed if it is not.
   *
   * Keyed on the provider's own id rather than on the handle: a Discord
   * username change would otherwise create a second account and leave the
   * player's characters behind on the first.
   */
  upsertAccount(input: Omit<AccountRecord, "id">): Promise<AccountRecord>;
  createSession(input: { tokenHash: string; accountId: string; expiresAt: string }): Promise<void>;
  /** Null when there is no such session, or it has expired. */
  accountForSession(tokenHash: string, now: string): Promise<AccountRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  charactersFor(accountId: string): Promise<StoredCharacter[]>;
  saveCharacters(accountId: string, characters: StoredCharacter[]): Promise<void>;
  deleteCharacters(accountId: string, ids: string[]): Promise<void>;
};

/** The slice of D1 used here, so a test can supply one without the runtime. */
export type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
};

const toRecord = (row: Record<string, unknown>): AccountRecord => ({
  id: String(row.id),
  provider: String(row.provider),
  providerId: String(row.provider_id),
  displayName: String(row.display_name),
  avatarUrl: row.avatar_url === null || row.avatar_url === undefined ? null : String(row.avatar_url),
});

export function d1Store(db: D1Like): Store {
  return {
    async upsertAccount(input) {
      const now = new Date().toISOString();

      /*
       * One statement rather than a read and a write. Two visits arriving at
       * once would both find no account and both insert one, and the unique
       * index would turn the second into an error on somebody's first sign-in.
       */
      await db
        .prepare(
          `insert into account (id, provider, provider_id, display_name, avatar_url, created_at, last_seen_at)
           values (?, ?, ?, ?, ?, ?, ?)
           on conflict (provider, provider_id) do update set
             display_name = excluded.display_name,
             avatar_url = excluded.avatar_url,
             last_seen_at = excluded.last_seen_at`,
        )
        .bind(crypto.randomUUID(), input.provider, input.providerId, input.displayName, input.avatarUrl, now, now)
        .run();

      const row = await db
        .prepare(`select * from account where provider = ? and provider_id = ?`)
        .bind(input.provider, input.providerId)
        .first();

      if (!row) throw new Error("Account was written and could not be read back.");
      return toRecord(row);
    },

    async createSession({ tokenHash, accountId, expiresAt }) {
      await db
        .prepare(`insert into session (token_hash, account_id, created_at, expires_at) values (?, ?, ?, ?)`)
        .bind(tokenHash, accountId, new Date().toISOString(), expiresAt)
        .run();
    },

    async accountForSession(tokenHash, now) {
      const row = await db
        .prepare(
          `select account.* from session
             join account on account.id = session.account_id
            where session.token_hash = ? and session.expires_at > ?`,
        )
        .bind(tokenHash, now)
        .first();

      return row ? toRecord(row) : null;
    },

    async deleteSession(tokenHash) {
      await db.prepare(`delete from session where token_hash = ?`).bind(tokenHash).run();
    },

    async charactersFor(accountId) {
      const { results } = await db
        .prepare(
          `select id, sealed_at, state, share_code, share_token from character
           where account_id = ? order by sealed_at desc`,
        )
        .bind(accountId)
        .all();

      return results.map((row) => ({
        id: String(row.id),
        sealedAt: String(row.sealed_at),
        // Written by this Worker from a validated body, so a parse failure here
        // is a corrupt row rather than untrusted input. It throws, which is the
        // right outcome: silently dropping a character is how a player loses
        // one without being told.
        state: JSON.parse(String(row.state)) as Record<string, unknown>,
        // Both columns or neither: a code with no token cannot be republished
        // and a token with no code points at nothing.
        ...(row.share_code && row.share_token
          ? { share: { code: String(row.share_code), writeToken: String(row.share_token) } }
          : {}),
      }));
    },

    async saveCharacters(accountId, characters) {
      if (characters.length === 0) return;

      await db.batch(
        characters.map((character) =>
          db
            .prepare(
              `insert into character (id, account_id, sealed_at, state, share_code, share_token)
               values (?, ?, ?, ?, ?, ?)
               on conflict (account_id, id) do update set
                 sealed_at = excluded.sealed_at,
                 state = excluded.state,
                 -- A machine that has never shared this character sends no
                 -- code. Taking its null would drop the code the other machine
                 -- holds, and the character would be republished under a new
                 -- one the next time anybody pressed share.
                 share_code = coalesce(excluded.share_code, character.share_code),
                 share_token = coalesce(excluded.share_token, character.share_token)`,
            )
            .bind(
              character.id,
              accountId,
              character.sealedAt,
              JSON.stringify(character.state),
              character.share?.code ?? null,
              character.share?.writeToken ?? null,
            ),
        ),
      );
    },

    async deleteCharacters(accountId, ids) {
      if (ids.length === 0) return;

      await db.batch(
        ids.map((id) =>
          db.prepare(`delete from character where account_id = ? and id = ?`).bind(accountId, id),
        ),
      );
    },
  };
}
