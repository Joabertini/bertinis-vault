/*
 * Language switch for the whole page, powered by Google's free website
 * translator (translate.google.com/translate_a/element.js).
 *
 * The page is written in Spanish. Choosing English asks Google to translate
 * whatever is painted on screen, in the visitor's own browser: interface,
 * rules text, anything. Choosing Spanish puts the page back.
 *
 * The visitor's choice is remembered in localStorage; Google's own state
 * lives in the `googtrans` cookie.
 */

export type Lang = "es" | "en";

const PAGE_LANG: Lang = "es";
const STORE_KEY = "faro.lang";
const SCRIPT_SRC = "https://translate.google.com/translate_a/element.js?cb=__faroTranslateInit";

declare global {
  interface Window {
    __faroTranslateInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          elementId: string,
        ) => unknown;
      };
    };
  }
}

export function savedLang(): Lang {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "es" || v === "en") return v;
  } catch {
    /* private window or blocked storage: fall through */
  }
  // First visit: follow the browser.
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}

function cookieDomains(): string[] {
  const host = location.hostname;
  return ["", host, `.${host}`];
}

function setGoogleCookie(lang: Lang) {
  // /es/es means "no translation".
  const value = `/${PAGE_LANG}/${lang}`;
  for (const d of cookieDomains()) {
    document.cookie = `googtrans=${value}; path=/${d ? `; domain=${d}` : ""}`;
  }
}

/*
 * Google wraps text in <font> nodes. React then tries to remove a node that is
 * no longer where it left it and throws. This is the well known fix: when the
 * child is not where React thinks, do nothing instead of crashing.
 */
let patched = false;
function protectReact() {
  if (patched || typeof Node === "undefined") return;
  patched = true;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    ref: Node | null,
  ): T {
    if (ref && ref.parentNode !== this) return node;
    return insert.call(this, node, ref) as T;
  };
}

let loading: Promise<void> | null = null;

function loadTranslator(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    if (!document.getElementById("google_translate_element")) {
      const holder = document.createElement("div");
      holder.id = "google_translate_element";
      // Hidden: our own switch is the only control.
      holder.style.display = "none";
      document.body.appendChild(holder);
    }
    window.__faroTranslateInit = () => {
      const T = window.google?.translate?.TranslateElement;
      if (!T) return reject(new Error("translator missing"));
      new T(
        { pageLanguage: PAGE_LANG, includedLanguages: "es,en", autoDisplay: false },
        "google_translate_element",
      );
      resolve();
    };
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onerror = () => reject(new Error("translator blocked"));
    document.head.appendChild(s);
  });
  return loading;
}

function pickInCombo(lang: Lang): boolean {
  const combo = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (!combo) return false;
  combo.value = lang;
  combo.dispatchEvent(new Event("change"));
  return true;
}

async function waitForCombo(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    if (document.querySelector("select.goog-te-combo")) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Switch the whole page. Resolves when the switch has been applied. */
export async function applyLang(lang: Lang): Promise<void> {
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    /* remembering is a nicety */
  }
  document.documentElement.lang = lang;

  // Spanish is the page's own language: nothing to load unless we are
  // undoing a translation already running.
  const running = document.documentElement.classList.contains("translated-ltr");
  if (lang === PAGE_LANG && !running) {
    setGoogleCookie(PAGE_LANG);
    return;
  }

  protectReact();
  setGoogleCookie(lang);
  try {
    await loadTranslator();
    if (!(await waitForCombo()) || !pickInCombo(lang)) throw new Error("no combo");
  } catch {
    // The translator did not come up (blocked, offline): the cookie is set,
    // so a reload lets Google apply it on its own.
    location.reload();
  }
}

/** Run once on startup: restore the remembered language. */
export function startLang(): void {
  const lang = savedLang();
  document.documentElement.lang = lang;
  if (lang !== PAGE_LANG) void applyLang(lang);
}
