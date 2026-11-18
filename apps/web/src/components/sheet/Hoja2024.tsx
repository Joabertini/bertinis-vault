import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "@/lib/builder";
import { HOJA_BASE, hojaDataFor, renderHoja } from "@/lib/hoja-2024";

/** The page is the same for every character; read it once. */
let template: Promise<string> | null = null;
function loadTemplate(): Promise<string> {
  template ??= fetch(`${HOJA_BASE}hoja.html`).then((response) => {
    if (!response.ok) throw new Error(`hoja.html: ${response.status}`);
    return response.text();
  });
  return template;
}

/**
 * The 2024 sheet: Foundry's own, filled with this character, in an iframe so
 * its stylesheet and the app's never meet.
 */
export default function Hoja2024({
  state,
  build,
  rulesVersion,
}: {
  state: BuilderState;
  build: CharacterBuild;
  rulesVersion: RulesVersion;
}) {
  const [page, setPage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const data = useMemo(() => hojaDataFor(state, build, rulesVersion), [state, build, rulesVersion]);

  useEffect(() => {
    let live = true;
    loadTemplate()
      .then((html) => live && setPage(renderHoja(html, data)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [data]);

  if (failed) {
    return <p className="px-8 py-10 font-body text-[15px] text-bone">No pude cargar la hoja. Probá de nuevo.</p>;
  }
  if (!page) return <div className="h-[760px]" aria-busy="true" />;

  return (
    <iframe
      title={`Hoja de ${data.name}`}
      srcDoc={page}
      className="block w-full border-0"
      style={{ height: 760, background: "transparent" }}
    />
  );
}
