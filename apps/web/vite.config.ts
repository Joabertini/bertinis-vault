import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@bertinis-vault/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@bertinis-vault/data-engine": fileURLToPath(
        new URL("../../packages/data-engine/src/index.ts", import.meta.url),
      ),
      "@bertinis-vault/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url),
      ),
      "@bertinis-vault/foundry-exporter": fileURLToPath(
        new URL("../../packages/foundry-exporter/src/index.ts", import.meta.url),
      ),
      "@bertinis-vault/vetools-index": fileURLToPath(
        new URL("../../packages/vetools-index/src/index.ts", import.meta.url),
      ),
      "@bertinis-vault/vetools-ref": fileURLToPath(
        new URL("../../packages/vetools-ref/src/index.ts", import.meta.url),
      ),
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
