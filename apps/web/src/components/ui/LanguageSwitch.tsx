import { useState } from "react";

import { applyLang, savedLang, type Lang } from "@/lib/translate";

/*
 * ES / EN, fixed in a corner of every screen. Choosing a language translates
 * the whole page (see lib/translate.ts).
 */
export default function LanguageSwitch() {
  const [lang, setLang] = useState<Lang>(savedLang);

  const choose = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    void applyLang(next);
  };

  return (
    // `notranslate`: the switch itself must keep reading ES / EN.
    <div
      translate="no"
      className="notranslate fixed right-4 top-4 z-[95] flex overflow-hidden rounded-full border border-gold/40 bg-black/70 font-mono text-[12px] uppercase tracking-[0.1em] backdrop-blur"
      role="group"
      aria-label="Idioma / Language"
    >
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          className={`px-3 py-1.5 transition-colors ${
            lang === l ? "bg-gold/20 text-gold" : "text-bone hover:text-gold"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
