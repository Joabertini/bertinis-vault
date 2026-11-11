/**
 * The cover of a character's book: the picture's limits and the sigil's role.
 */

import { describe, expect, it } from "vitest";

import { coerceBuilderState, initialState } from "@/lib/builder";
import { COVER_HEIGHT, COVER_WIDTH, MAX_COVER_CHARS, coverCrop, isCoverImage } from "@/lib/cover-image";
import { ROLE_SIGILS, sigilFor, sigilRoleFor } from "@/lib/role-sigil";

const tiny = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

describe("role sigil", () => {
  it("gives every D&D class one of the five picker roles", () => {
    expect(sigilRoleFor("fighter")).toBe("dano");
    expect(sigilRoleFor("paladin")).toBe("defensa");
    expect(sigilRoleFor("cleric")).toBe("sanacion");
    expect(sigilRoleFor("bard")).toBe("apoyo");
    expect(sigilRoleFor("wizard")).toBe("control");
  });

  it("falls back to damage for a class it does not know", () => {
    expect(sigilRoleFor("homebrew-class")).toBe("dano");
    expect(sigilFor("homebrew-class").id).toBe("dano");
  });

  it("carries the picker's colours and one glyph per role", () => {
    expect(ROLE_SIGILS.control.color).toBe("#a76bff");
    for (const sigil of Object.values(ROLE_SIGILS)) expect(sigil.paths.length).toBeGreaterThan(0);
  });
});

describe("cover image", () => {
  it("crops a wide picture from the middle to the book's 2:3", () => {
    const crop = coverCrop(3000, 1000);
    expect(crop.h).toBe(1000);
    expect(crop.w / crop.h).toBeCloseTo(COVER_WIDTH / COVER_HEIGHT);
    expect(crop.x).toBeCloseTo((3000 - crop.w) / 2);
  });

  it("crops a tall picture from the middle too", () => {
    const crop = coverCrop(1000, 4000);
    expect(crop.w).toBe(1000);
    expect(crop.y).toBeCloseTo((4000 - crop.h) / 2);
  });

  it("accepts a small image data URL and nothing else", () => {
    expect(isCoverImage(tiny)).toBe(true);
    expect(isCoverImage("")).toBe(false);
    expect(isCoverImage("https://example.com/x.png")).toBe(false);
    expect(isCoverImage("data:text/html;base64,PGgxPg==")).toBe(false);
    expect(isCoverImage(`data:image/webp;base64,${"A".repeat(MAX_COVER_CHARS)}`)).toBe(false);
  });

  it("keeps a valid cover through coercion and drops an invalid one", () => {
    expect(coerceBuilderState({ ...initialState, coverImage: tiny }).coverImage).toBe(tiny);
    expect(coerceBuilderState({ ...initialState, coverImage: "javascript:alert(1)" }).coverImage).toBe("");
    const legacy: Record<string, unknown> = { ...initialState };
    delete legacy.coverImage;
    expect(coerceBuilderState(legacy).coverImage).toBe("");
  });
});
