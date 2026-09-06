/**
 * The roll20 sheet, rendered.
 *
 * The sheet is not built here — it is fetched, filled and mounted. Three
 * decisions worth knowing:
 *
 * **A shadow root.** The vendored stylesheet is 109KB written for a page that
 * is not this one, and this app's Tailwind base would fight it in both
 * directions. A shadow root ends that argument: nothing of the sheet's escapes,
 * nothing of the app's reaches in.
 *
 * **Fetched, not imported.** The sheet is 2.1MB of markup. Imported it would
 * sit in the bundle for every visitor including the ones who never open a
 * tome; fetched from `public/`, it costs a request the first time a sheet is
 * opened and is then in the browser cache.
 *
 * **The roll buttons stay and do nothing.** They are `<button type="roll">`
 * with a roll20 macro in `value`; outside roll20 there is nothing to receive
 * it. Removing them would take their layout with them, and the sheet was asked
 * for as a sheet to read.
 */

import { useEffect, useRef, useState } from "react";

import type { SheetData } from "@/lib/sheet-data";
import { shapedDataFor } from "@/lib/shaped-attrs";
import { renderShaped } from "@/lib/shaped-render";

type Vendored = { html: string; css: string; labels: Record<string, string> };

/**
 * Fetched once per page load, not once per sheet.
 *
 * A promise rather than a value: two tomes opened before the first answer
 * arrives must not start two downloads of a 2.1MB file.
 */
let pending: Promise<Vendored> | null = null;

function loadSheet(): Promise<Vendored> {
  pending ??= (async () => {
    const [html, css, labels] = await Promise.all([
      fetch("/hoja/sheet.html").then((response) => response.text()),
      fetch("/hoja/sheet.css").then((response) => response.text()),
      fetch("/hoja/labels.json").then((response) => response.json() as Promise<Record<string, string>>),
    ]);
    return { html, css, labels };
  })();

  return pending;
}

export default function ShapedSheet({ data }: { data: SheetData }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    loadSheet()
      .then((vendored) => {
        if (!live || !host.current) return;

        const shadow = host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" });

        // `.charsheet` is roll20's own wrapper and the stylesheet expects it.
        const parsed = new DOMParser().parseFromString(
          `<div class="charsheet">${vendored.html}</div>`,
          "text/html",
        );
        const root = parsed.body.firstElementChild;
        if (!root) return;

        renderShaped(root, shapedDataFor(data, vendored.labels), vendored.labels);

        const style = document.createElement("style");
        style.textContent = vendored.css;
        shadow.replaceChildren(style, document.importNode(root, true));
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [data]);

  if (failed) {
    return (
      <p className="px-8 py-10 font-body text-sm italic text-bone/60">
        No se pudo cargar la hoja. Recargá la página; si sigue, el archivo de la hoja no llegó al
        despliegue.
      </p>
    );
  }

  return <div ref={host} className="min-h-[400px]" />;
}
