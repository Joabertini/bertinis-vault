/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the Worker that stores builds lives. See `.env`. */
  readonly VITE_VAULT_URL?: string;
  /** Turnstile's public site key. Unset means publishing sends no token. See `lib/turnstile.ts`. */
  readonly VITE_TURNSTILE_SITEKEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
