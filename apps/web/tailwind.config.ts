import containerQueries from "@tailwindcss/container-queries";
import type { Config } from "tailwindcss";

export default {
  // The package holds class strings too (tints, palettes); unscanned, they are purged.
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/forge/src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        ash: "#0B0B0B",
        raised: "#141414",
        bone: "#FFFFFF",
        gold: "#F2C14E",
        blood: "#6E0F0F",
        ember: "#FF7043",
        iron: "#5A5A5A",
      },
      fontFamily: {
        /*
         * Cinzel, not Cinzel Decorative.
         *
         * The Decorative cut carries swashes and flourished terminals that
         * read as Arabian-nights rather than as anything on a D&D shelf.
         * Plain Cinzel is Trajan-derived Roman capitals — the lineage actual
         * fantasy titling has used for decades, and legible at the small
         * tracking the chamber labels need.
         */
        display: ["Cinzel", "serif"],
        /*
         * The wordmark, and nothing else.
         *
         * Jim Nightshade ships with a single weight and a lot of character —
         * right for four words on a title card, wrong for a chamber label set
         * in 9px letter-spaced capitals, which is what `font-display` covers.
         */
        title: ["Jim Nightshade", "Cinzel", "serif"],
        body: ["EB Garamond", "serif"],
        /*
         * Numbers. Cinzel draws its 1 as a Roman I, so "11" reads "II" and
         * "114" reads "II4". Every number a player reads is set in EB Garamond
         * with lining figures instead (see base.css).
         */
        num: ["EB Garamond", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  // The 3D shelf (components/codex/shelf) styles itself with @min-[…]/@max-[…].
  plugins: [containerQueries],
} satisfies Config;
