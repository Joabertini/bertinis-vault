import { useEffect, useMemo, useRef, useState } from "react";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import type { BuilderState } from "@/lib/builder";
import {
  HOJA_BASE,
  HOJA_RULE_KINDS,
  applyHojaEdit,
  hojaDataFor,
  renderHoja,
  type HojaEdit,
  type HojaEstado,
  type HojaRules,
  type HojaUi,
} from "@/lib/hoja-2024";
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
 * Play state an earlier build kept in this browser only. Read once, so a character played
 * before the state moved into the character does not lose its hit points.
 */
function legacyEstado(characterId: string): HojaEstado {
  try {
    const raw = localStorage.getItem(`hoja-2024:estado:${characterId}`);
    return raw ? (JSON.parse(raw) as HojaEstado) : {};
  } catch {
    return {};
  }
}

/**
 * The 2024 sheet: Foundry's own, filled with this character, in an iframe so
 * its stylesheet and the app's never meet.
 *
 * It plays and edits like Foundry's: what the player changes on it goes into the character
 * (`onPatch`), which is saved and synced like any other edit.
 */
export default function Hoja2024({
  characterId,
  state,
  build,
  rulesVersion,
  onPatch,
  onClose,
  onVision,
  onEdit,
}: {
  /** Whose sheet this is. */
  characterId: string;
  state: BuilderState;
  build: CharacterBuild;
  rulesVersion: RulesVersion;
  /** Writes a change made on the sheet into the character. */
  onPatch: (patch: Partial<BuilderState>) => void;
  /** The sheet's own X and Escape. */
  onClose: () => void;
  /** The sheet's "Recordatorios" button. */
  onVision: () => void;
  /** "Editar en la Forja", from the sheet's ⋮ menu. */
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

  // The latest character and build, for the messages; the tab and mode the player is in.
  const latest = useRef({ state, build });
  latest.current = { state, build };
  const ui = useRef<HojaUi>({});

  /*
   * Play state (hit points, conditions…) changes on every click and lives in `state.hoja`. The
   * page already shows it, so it must not redraw the sheet: only the rest of the character does.
   */
  const played = (state.hoja ?? {}) as HojaEstado;
  // What the sheet's edits keep in `hoja` does change what it prints: things taken off, hit point maximum.
  const characterKey = JSON.stringify({ ...state, hoja: { quitados: played.quitados, hpMax: played.hpMax } });
  const data = useMemo(
    () => hojaDataFor(latest.current.state, latest.current.build, rulesVersion, rules ?? {}),
    // The key stands for state and build: the build derives from the same character.
    [characterKey, rulesVersion, rules],
  );

  useEffect(() => {
    if (!rules) return;
    let live = true;
    const saved = latest.current.state.hoja as HojaEstado;
    const estado = saved && Object.keys(saved).length > 0 ? saved : legacyEstado(characterId);
    loadTemplate()
      .then((html) => live && setPage(renderHoja(html, data, estado, ui.current)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [data, rules, characterId]);

  // The page inside the iframe asks for what only this page can do.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = event.data as { hoja?: string; estado?: HojaEstado; edit?: HojaEdit; ui?: HojaUi } | null;
      switch (message?.hoja) {
        case "cerrar":
          return onClose();
        case "vision":
          return onVision();
        case "editar":
          return onEdit();
        case "ui":
          if (message.ui) ui.current = message.ui;
          return;
        case "estado":
          if (message.estado) {
            onPatch({ hoja: { ...(latest.current.state.hoja ?? {}), ...message.estado } });
          }
          return;
        case "cambio":
          if (message.edit) {
            const patch = applyHojaEdit(latest.current.state, latest.current.build, message.edit);
            if (Object.keys(patch).length > 0) onPatch(patch);
          }
          return;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose, onVision, onEdit, onPatch]);

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
