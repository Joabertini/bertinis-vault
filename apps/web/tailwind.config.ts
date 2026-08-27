import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#030202",
        ash: "#12100D",
        bone: "#E6DFCE",
        gold: "#B08A3E",
        blood: "#6E0F0F",
        ember: "#FF5A1F",
        iron: "#4A4640",
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
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
