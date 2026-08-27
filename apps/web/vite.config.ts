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
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
