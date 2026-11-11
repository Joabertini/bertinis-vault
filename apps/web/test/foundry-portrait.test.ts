/**
 * The picture an imported Foundry actor brings of its own.
 */

import { describe, expect, it } from "vitest";

import { portraitOf } from "@/lib/foundry-import";

describe("portraitOf", () => {
  it("returns the path Foundry wrote for the portrait", () => {
    expect(portraitOf({ img: "assets/Tokens%20PCs/Rathma.jpg" })).toBe("assets/Tokens%20PCs/Rathma.jpg");
  });

  it("ignores Foundry's stock icons", () => {
    expect(portraitOf({ img: "icons/svg/mystery-man.svg" })).toBe("");
    expect(portraitOf({ img: "systems/dnd5e/icons/svg/actors/character.svg" })).toBe("");
  });

  it("falls back to the token when the sheet has no portrait of its own", () => {
    expect(
      portraitOf({ img: "icons/svg/mystery-man.svg", prototypeToken: { texture: { src: "assets/Token%20Rathma.png" } } }),
    ).toBe("assets/Token%20Rathma.png");
  });

  it("keeps an embedded image and skips things that are not images", () => {
    expect(portraitOf({ img: "data:image/webp;base64,AAAA" })).toBe("data:image/webp;base64,AAAA");
    expect(portraitOf({ img: "assets/video.webm" })).toBe("");
    expect(portraitOf({})).toBe("");
  });
});
