import { useEffect, useMemo, useRef, useState } from "react";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "@/lib/builder";
import { HOJA_BASE, HOJA_RULE_KINDS, hojaDataFor, renderHoja, type HojaEstado, type HojaRules } from "@/lib/hoja-2024";
import { loadKind } from "@/lib/rules-text";

/** The page is the same for every character; read it once. */
let template: Promise<string> | null = null;
function loadTemplate(): Promise<string> {
  template ??= fetch(`${HOJA_BASE}hoja.html`).then((response) => {
    if (!response.ok) throw new Error(`hoja.html: ${response.status}`);
    return response.text();
  });
  return template;
}

/** Class features and spell details come from the rules text; without it the sheet still opens. */
let rulesText: Promise<HojaRules> | null = null;
function loadRules(): Promise<HojaRules> {
  rulesText ??= Promise.all(HOJA_RULE_KINDS.map((kind) => loadKind(kind)))
    .then((tables) => Object.fromEntries(HOJA_RULE_KINDS.map((kind, index) => [kind, tables[index]])) as HojaRules)
    .catch(() => {
      rulesText = null;
      return {};
    });
  return rulesText;
}

/**
 * What the player changed while playing (hit points, hit dice, what is worn…), per character, in
 * this browser. The sheet hands it over each time it changes; it comes back when the sheet opens.
 */
const estadoKey = (characterId: string) => `hoja-2024:estado:${characterId}`;
function leerEstado(characterId: string): HojaEstado {
  try {
    const raw = localStorage.getItem(estadoKey(characterId));
    return raw ? (JSON.parse(raw) as HojaEstado) : {};
  } catch {
    return {};
  }
}
function guardarEstado(characterId: string, estado: HojaEstado) {
  try {
    localStorage.setItem(estadoKey(characterId), JSON.stringify(estado));
  } catch {
    // Private window or full storage: the sheet still plays, it just forgets on close.
  }
}

/**
 * The 2024 sheet: Foundry's own, filled with this character, in an iframe so
 * its stylesheet and the app's never meet.
 */
export default function Hoja2024({
  characterId,
  state,
  build,
  rulesVersion,
  onClose,
  onVision,
  onEdit,
}: {
  /** Whose play state this is. */
  characterId: string;
  state: BuilderState;
  build: CharacterBuild;
  rulesVersion: RulesVersion;
  /** The sheet's own X and Escape. */
  onClose: () => void;
  /** The sheet's "Recordatorios" button. */
  onVision: () => void;
  /** The sheet's edit switch: editing a character is the Forge's job. */
  onEdit: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [rules, setRules] = useState<HojaRules | null>(null);
  useEffect(() => {
    let live = true;
    void loadRules().then((loaded) => live && setRules(loaded));
    return () => {
      live = false;
    };
  }, []);
  const data = useMemo(() => hojaDataFor(state, build, rulesVersion, rules ?? {}), [state, build, rulesVersion, rules]);

  useEffect(() => {
    if (!rules) return;
    let live = true;
    loadTemplate()
      .then((html) => live && setPage(renderHoja(html, data, leerEstado(characterId))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // characterId only changes with the character, and then data does too.
  }, [data, rules]);

  // The page inside the iframe asks for what only this page can do.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.hoja === "cerrar") onClose();
      else if (event.data?.hoja === "vision") onVision();
      else if (event.data?.hoja === "editar") onEdit();
      else if (event.data?.hoja === "estado" && event.data.estado) guardarEstado(characterId, event.data.estado as HojaEstado);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose, onVision, onEdit, characterId]);

  if (failed) {
    return <p className="px-8 py-10 font-body text-[15px] text-bone">No pude cargar la hoja. Probá de nuevo.</p>;
  }
  if (!page) return <div className="h-[720px]" aria-busy="true" />;

  return (
    <iframe
      ref={frame}
      title={`Hoja de ${data.name}`}
      srcDoc={page}
      className="block border-0"
      style={{ width: 850, height: 720, background: "transparent", colorScheme: "normal" }}
    />
  );
}
