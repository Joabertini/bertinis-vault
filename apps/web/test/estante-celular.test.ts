import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { describe, expect, test } from "vitest";

import config from "../tailwind.config";

/**
 * Tailwind drops a variant it does not know without a word. The detail panel of
 * the shelf is laid out for a phone with container queries, so the check is on
 * the CSS that comes out, not on the class names.
 */
describe("el estante en celular", () => {
  test("las reglas para un estante angosto llegan al CSS", async () => {
    const source = readFileSync(resolve("src/components/codex/shelf/BooksShowcase.tsx"), "utf8");
    const { css } = await postcss([
      tailwind({ ...config, content: [{ raw: source, extension: "tsx" }] }),
    ]).process("@tailwind utilities;", { from: undefined });
    const under = (query: string) => {
      const found: string[] = [];
      postcss.parse(css).walkAtRules("container", (rule) => {
        if (rule.params.replace(/\s+/g, "") !== query) return;
        rule.walkDecls((decl) => void found.push(`${decl.prop}:${decl.value}`));
      });
      return found;
    };

    // The panel goes to the bottom and the close button to the corner.
    expect(under("(max-width:760px)")).toEqual(expect.arrayContaining(["bottom:3.5%", "right:12px"]));
    // The arrows grow on a wide shelf.
    expect(under("(min-width:768px)")).toContain("height:3rem");
    // No variant left that the plugin ignores.
    expect(source).not.toMatch(/@(max|min)-\[/);
  });
});
