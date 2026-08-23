import { describe, expect, test } from "vitest";

import { buildCanonicalSnapshot, initialState, isCharacterNameMissing } from "../src/builder";

/**
 * A draft is not a finished character. The canonical schema requires a name,
 * which is right for something being exported, but the builder derives a
 * snapshot on every keystroke — including the keystroke that empties a field.
 */
describe("a half-written draft", () => {
  test("survives an empty character name", () => {
    expect(() => buildCanonicalSnapshot({ ...initialState, characterName: "" })).not.toThrow();
  });

  test("survives an empty player name", () => {
    expect(() => buildCanonicalSnapshot({ ...initialState, playerName: "" })).not.toThrow();
  });

  test("survives a name that is only whitespace", () => {
    expect(() => buildCanonicalSnapshot({ ...initialState, characterName: "   " })).not.toThrow();
  });

  test("does not invent a name the player never typed", () => {
    const snapshot = buildCanonicalSnapshot({ ...initialState, characterName: "" });

    expect(snapshot.identity.characterName.trim()).not.toBe("");
    expect(isCharacterNameMissing({ ...initialState, characterName: "" })).toBe(true);
    expect(isCharacterNameMissing(initialState)).toBe(false);
  });

  test("omits an empty player name rather than storing a blank one", () => {
    const snapshot = buildCanonicalSnapshot({ ...initialState, playerName: "  " });

    expect(snapshot.identity.playerName).toBeUndefined();
  });
});

/**
 * Every optional label in the schema reads as `.min(1).optional()`, so a
 * cleared field is a violation while an absent one is fine. All of these are
 * plain text inputs the player can empty.
 */
describe("cleared optional fields", () => {
  const optionalFields = ["playerName", "alignment", "trait", "ideal", "bond", "flaw", "notes"] as const;

  test.each(optionalFields)("an empty %s does not break the snapshot", (field) => {
    expect(() => buildCanonicalSnapshot({ ...initialState, [field]: "" })).not.toThrow();
  });

  test("all of them cleared at once still derives", () => {
    const emptied = optionalFields.reduce((state, field) => ({ ...state, [field]: "" }), initialState);

    expect(() => buildCanonicalSnapshot(emptied)).not.toThrow();
  });
});
