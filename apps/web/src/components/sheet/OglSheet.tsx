/**
 * La hoja de roll20, montada.
 *
 * Acá no se construye nada: se busca, se llena y se cuelga. Tres decisiones que
 * conviene saber:
 *
 * **Un shadow root.** La hoja trae su propia hoja de estilos, escrita para una
 * página que no es esta, y la base de Tailwind pelearía con ella en las dos
 * direcciones. El shadow root termina la discusión: no se escapa nada de la
 * hoja ni le entra nada de la app.
 *
 * **Buscada, no importada.** Es 1MB de marcado. Importada viajaría en el bundle
 * de todo el mundo, incluso de quien nunca abre un tomo; buscada de `public/`
 * cuesta un pedido la primera vez y después está en la caché del navegador.
 *
 * **Los botones de tirada quedan y no hacen nada.** Son `<button type="roll">`
 * con una macro de roll20 en `value`; fuera de roll20 no hay quién la reciba.
 * Sacarlos se llevaría su lugar en la grilla, y la hoja se pidió para leerla.
 */

import { useEffect, useRef, useState } from "react";

import { oglDataFor } from "@/lib/ogl-attrs";
import { renderOgl } from "@/lib/ogl-render";
import type { SheetData } from "@/lib/sheet-data";

type Vendored = { html: string; css: string };

/**
 * Se busca una vez por carga de página, no una vez por hoja.
 *
 * Una promesa y no un valor: dos tomos abiertos antes de que llegue la primera
 * respuesta no pueden arrancar dos descargas del mismo archivo.
 */
let pending: Promise<Vendored> | null = null;

function loadSheet(): Promise<Vendored> {
  pending ??= (async () => {
    const [html, css] = await Promise.all([
      fetch("/hoja/sheet.html").then((response) => response.text()),
      fetch("/hoja/sheet.css").then((response) => response.text()),
    ]);
    return { html, css };
  })();

  return pending;
}

export default function OglSheet({ data }: { data: SheetData }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    loadSheet()
      .then((vendored) => {
        if (!live || !host.current) return;

        const shadow = host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" });

        // El recorte ya viene con el `.charsheet` de roll20 como raíz, que es
        // el nodo al que la hoja de estilos le cuelga todo. No se envuelve.
        const parsed = new DOMParser().parseFromString(vendored.html, "text/html");
        const root = parsed.body.firstElementChild;
        if (!root) return;

        renderOgl(root, oglDataFor(data));

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
