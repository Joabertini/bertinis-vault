import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * The app's own aliases, plus a DOM. The builder derives a character while it
 * renders, so a test that only imports modules would miss the failures that
 * happen on the page.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.{ts,tsx}"],
      restoreMocks: true,
    },
  }),
);
