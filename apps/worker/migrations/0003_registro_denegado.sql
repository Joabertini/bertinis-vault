-- Registrations held back by the suspicion score, kept for whoever reads the appeal.
--
-- Run with:
--   wrangler d1 migrations apply alba --remote
--
-- One row per Discord identity, overwritten on a new attempt: this is a list of people to look at, not
-- a log. It stores the Discord id, the display name, the score and the reasons in plain Spanish, and
-- nothing else — no token, no IP, no avatar.
--
-- The Worker keeps refusing when this table does not exist yet: writing the row is best effort.

create table if not exists registration_denied (
  provider      text not null,
  provider_id   text not null,
  display_name  text not null,
  score         integer not null,
  reasons       text not null,
  denied_at     text not null,
  primary key (provider, provider_id)
);
