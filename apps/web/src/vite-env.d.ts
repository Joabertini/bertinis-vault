/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Worker that stores builds lives. See `.env`. */
  readonly VITE_VAULT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
