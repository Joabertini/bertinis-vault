/**
 * The page's half of Cloudflare Turnstile.
 *
 * Publishing and uploading carry a short-lived token that Cloudflare hands the browser, and the Worker
 * asks Cloudflare whether it is good (`apps/worker/src/turnstile.ts`). For nearly everybody the widget
 * never shows: it runs in `interaction-only` mode and appears only when Cloudflare wants a click.
 *
 * Off unless `VITE_TURNSTILE_SITEKEY` is set. The site key is public by design (it is in the page
 * source of every site that uses it), so it can live in `.env.production`; the secret half is a Worker
 * secret and never comes near the front.
 *
 * A token is good for one write, so a fresh widget is made for each and removed after it. Nothing here
 * throws: a token that could not be had is `null`, and the Worker decides what that means.
 */

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widget: string): void;
  remove(widget: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long to wait for a token before giving up and sending the write without one. */
const TOKEN_TIMEOUT_MS = 30_000;

function siteKey(): string | null {
  const key = import.meta.env.VITE_TURNSTILE_SITEKEY?.trim();
  return key ? key : null;
}

export const turnstileEnabled = (): boolean => siteKey() !== null;

let loading: Promise<TurnstileApi | null> | null = null;

/** Cloudflare's script, loaded once. Null when it cannot be had (blocked, offline). */
function loadScript(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise<TurnstileApi | null>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      // Forgotten, so the next write tries again instead of staying without it until a reload.
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return loading;
}

/** A token for one write, or null when Turnstile is off or could not run. */
export async function turnstileToken(): Promise<string | null> {
  const key = siteKey();
  if (!key || typeof document === "undefined") return null;

  const api = await loadScript();
  if (!api) return null;

  // Where an interactive challenge would appear. Empty, and so invisible, the rest of the time.
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647";
  document.body.appendChild(box);

  return new Promise<string | null>((resolve) => {
    let widget: string | null = null;
    let done = false;

    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (widget) {
        try {
          api.remove(widget);
        } catch {
          // Already gone.
        }
      }
      box.remove();
      resolve(token);
    };

    const timer = setTimeout(() => finish(null), TOKEN_TIMEOUT_MS);

    try {
      widget = api.render(box, {
        sitekey: key,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => finish(token),
        "error-callback": () => finish(null),
        "timeout-callback": () => finish(null),
      });
      api.execute(widget);
    } catch {
      finish(null);
    }
  });
}

/** The header to add to a write, empty when there is no token. */
export async function turnstileHeaders(): Promise<Record<string, string>> {
  const token = await turnstileToken();
  return token ? { "X-Turnstile-Token": token } : {};
}
