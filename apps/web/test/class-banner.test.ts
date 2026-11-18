import { describe, expect, test } from "vitest";

import { coerceBuilderState, initialState } from "../src/lib/builder";
import { BANNER_HEIGHT, BANNER_WIDTH, bannerFor, classBannerSvg, shadeColor } from "../src/lib/class-banner";
import { CLASS_SIGILS } from "../src/lib/class-sigils";

const stored = "https://api.bertinilabs.xyz/images/2VwHMehOmMUXqI75QvUKKqS2NiW4Tzxk";

describe("el banner de la hoja", () => {
  test("el de cada clase usa su color y graba su sigilo", () => {
    for (const [id, art] of Object.entries(CLASS_SIGILS)) {
      const svg = classBannerSvg(id);
      expect(svg).toContain(`width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}"`);
      expect(svg).toContain(shadeColor(art.color, 0.85));
      expect(svg).toContain(art.glyph.slice(0, 40));
    }
  });

  test("sin clase, un degradé neutro y nada grabado", () => {
    expect(classBannerSvg("")).not.toContain("<path");
  });

  test("el subido manda; sin subir, el de la clase", () => {
    expect(bannerFor({ bannerImage: stored, classId: "fighter" })).toBe(stored);
    expect(bannerFor({ bannerImage: "", classId: "fighter" })).toMatch(/^data:image\/svg\+xml/);
  });

  test("se guarda solo una dirección del almacén", () => {
    expect(coerceBuilderState({ ...initialState, bannerImage: stored }).bannerImage).toBe(stored);
    expect(coerceBuilderState({ ...initialState, bannerImage: "javascript:alert(1)" }).bannerImage).toBe("");
    expect(coerceBuilderState({ ...initialState }).bannerImage).toBe("");
  });
});
