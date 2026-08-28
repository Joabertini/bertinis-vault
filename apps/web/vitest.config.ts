import { mergeConfig } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * The app's own aliases, plus a DOM. The builder derives a character while it
 * renders, so a test that only imports modules would miss the failures that
 * happen on the page.
 *
 * `test/pending/` is excluded on purpose: those suites describe behaviour the
 * Faro front does not expose yet, under the old front's API. They are kept as
 * a specification rather than deleted — see `test/pending/README.md`. Spread
 * of `configDefaults.exclude` keeps node_modules and friends excluded too;
 * setting `exclude` alone would replace those defaults.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.{ts,tsx}"],
      exclude: [...configDefaults.exclude, "test/pending/**"],
      restoreMocks: true,
    },
  }),
);
