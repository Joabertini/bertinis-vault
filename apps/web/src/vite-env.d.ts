/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Worker that stores builds lives. See `.env`. */
  readonly VITE_VAULT_URL?: string;
  /** Faro del Alba's app, when this build is the Forge inside it. */
  readonly VITE_FARO_APP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
