import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The workspace packages resolve to their `src/index.ts`, not their `dist/`.
 *
 * The package deps are declared `workspace:*` in package.json, so Node would
 * resolve them either way. Pointing at source means editing a package shows up
 * here on the next reload without a rebuild, which is why the standalone
 * prototype's `dist/` aliases were dropped rather than carried over.
 */
const vaultPackage = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@bertinis-vault/contracts": vaultPackage("contracts"),
      "@bertinis-vault/data-engine": vaultPackage("data-engine"),
      "@bertinis-vault/domain": vaultPackage("domain"),
      "@bertinis-vault/foundry-exporter": vaultPackage("foundry-exporter"),
      "@bertinis-vault/vetools-index": vaultPackage("vetools-index"),
      "@bertinis-vault/vetools-ref": vaultPackage("vetools-ref"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * Three kinds of chunk instead of one, split by how often each moves.
         *
         * The 5etools index is 1.3MB of JSON and changes when the data is
         * regenerated, which is almost never. The vendor libraries change when
         * they are upgraded. The app changes every deploy. In one chunk a typo
         * fix made every player re-download all of D&D.
         *
         * This does not make the first load smaller: the same bytes arrive.
         * It makes every load after it cheap, which is the load a player at a
         * table actually has.
         */
        manualChunks(id: string) {
          // Rollup hands back native paths, so on Windows the separators are
          // backslashes. Matching on "/" alone splits nothing while the config
          // looks right.
          const path = id.split("\\").join("/");

          // Its own chunk, and before the index: the entry reads the book
          // library from here, and if these modules lived in `index-data` the
          // landing page would download the whole 5etools index to get at them.
          if (path.includes("packages/vetools-ref")) return "vetools-ref";
          // Same reason: the landing's store merges two shelves with a helper
          // from here, and the index imports this package too, so Rollup
          // filed it under `index-data` and the landing paid for the index.
          if (path.includes("packages/contracts")) return "contracts";
          if (path.includes("packages/vetools-index")) return "index-data";
          // three.js only serves the Codex shelf. Left to the rule below it would
          // be folded into `vendor`, which every page downloads.
          if (path.includes("node_modules/three/")) return "three";
          if (path.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },

  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
