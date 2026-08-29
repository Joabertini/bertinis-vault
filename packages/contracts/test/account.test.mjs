/**
 * The merge rule, which runs in two places and must not disagree with itself.
 *
 * The browser folds an imported Codex file into the one it has; the Worker
 * folds a machine's Codex into the account's. Same question, so the same
 * function answers it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CHARACTERS_PER_ACCOUNT,
  accountSchema,
  mergeByNewest,
  storedCharacterSchema,
  syncRequestSchema,
} from "../dist/index.js";

const at = (day, id = "a", name = id) => ({
  id,
  sealedAt: `2026-08-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  state: { characterName: name },
});

test("a character the other side does not have is added", () => {
  const merged = mergeByNewest([], [at(1)]);

  assert.equal(merged.added, 1);
  assert.equal(merged.characters.length, 1);
});

test("the later seal wins, and it can be either side", () => {
  // The only rule that cannot lose an edit.
  const newer = mergeByNewest([at(1, "a", "viejo")], [at(9, "a", "nuevo")]);
  assert.equal(newer.updated, 1);
  assert.equal(newer.characters[0].state.characterName, "nuevo");

  const older = mergeByNewest([at(9, "a", "nuevo")], [at(1, "a", "viejo")]);
  assert.equal(older.kept, 1);
  assert.equal(older.characters[0].state.characterName, "nuevo");
});

test("an entry with no seal date loses to every real one", () => {
  // ISO timestamps sort as text, and the empty string sorts before all of them,
  // which is the right outcome for a character that never says when it was
  // sealed.
  const merged = mergeByNewest([at(1)], [{ id: "a", sealedAt: "", state: {} }]);

  assert.equal(merged.kept, 1);
  assert.equal(merged.characters[0].state.characterName, "a");
});

test("nothing is ever deleted by merging", () => {
  // Signing in on a second machine must not delete the character built on the
  // first.
  const merged = mergeByNewest([at(1, "a")], [at(1, "b")]);

  assert.deepEqual(
    merged.characters.map((entry) => entry.id).sort(),
    ["a", "b"],
  );
});

test("the result reads newest first, the way the Codex does", () => {
  const merged = mergeByNewest([at(1, "a")], [at(9, "b"), at(5, "c")]);

  assert.deepEqual(
    merged.characters.map((entry) => entry.id),
    ["b", "c", "a"],
  );
});

test("a character's state is carried without being read", () => {
  /*
   * The server stores builder states, and a builder state changes every time
   * the builder learns a new question. A schema with an opinion about its shape
   * would start refusing characters it has no business judging.
   */
  const parsed = storedCharacterSchema.parse({
    id: "a",
    sealedAt: "2026-08-01T00:00:00.000Z",
    state: { campoQueNadieConoce: [1, 2, 3] },
  });

  assert.deepEqual(parsed.state, { campoQueNadieConoce: [1, 2, 3] });
});

test("a Codex larger than an account holds is refused, not truncated", () => {
  const characters = Array.from({ length: MAX_CHARACTERS_PER_ACCOUNT + 1 }, (_, i) => at(1, `c${i}`));

  assert.equal(syncRequestSchema.safeParse({ characters }).success, false);
});

test("burning nothing is the ordinary case", () => {
  assert.deepEqual(syncRequestSchema.parse({ characters: [] }).burned, []);
});

test("an account is only what a page needs to greet somebody", () => {
  const account = accountSchema.parse({
    id: "acc-1",
    provider: "discord",
    displayName: "Bertini",
    avatarUrl: null,
  });

  assert.deepEqual(Object.keys(account).sort(), ["avatarUrl", "displayName", "id", "provider"]);
});
