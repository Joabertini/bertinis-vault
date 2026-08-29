-- Accounts, sessions and the characters an account keeps.
--
-- Run with:
--   wrangler d1 migrations apply ALBA --remote
--
-- `state` is stored as text and never read by the server. A character is a
-- builder state, that state changes every time the builder learns a new
-- question, and a server with an opinion about its shape would have to be
-- redeployed in step with the front or start refusing characters.

create table if not exists account (
  id            text primary key,
  provider      text not null,
  -- The provider's own id for this person. Never the email or the handle:
  -- both change, and a Discord username change would create a second account.
  provider_id   text not null,
  display_name  text not null,
  avatar_url    text,
  created_at    text not null,
  last_seen_at  text not null
);

create unique index if not exists account_provider on account (provider, provider_id);

create table if not exists session (
  -- The SHA-256 of the token, never the token. A leaked database is then a
  -- database of hashes rather than a drawer of working keys.
  token_hash  text primary key,
  account_id  text not null references account (id) on delete cascade,
  created_at  text not null,
  expires_at  text not null
);

create index if not exists session_account on session (account_id);

create table if not exists character (
  -- The Codex's own id, so a character that syncs twice is one character.
  id          text not null,
  account_id  text not null references account (id) on delete cascade,
  -- When it was last sealed, which is both the date and the version marker.
  sealed_at   text not null,
  state       text not null,
  primary key (account_id, id)
);

create index if not exists character_account on character (account_id, sealed_at desc);
