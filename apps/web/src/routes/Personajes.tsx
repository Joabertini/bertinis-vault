/**
 * "Mis personajes": the Codex without its page, framed by the profile in Faro del Alba.
 *
 * Same shelf, sheet, reminders and dice tray. The profile draws the title, the background and the
 * sign-in, so none of them are here.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import CodexBackup from "@/components/codex/CodexBackup";
import DropActor from "@/components/codex/DropActor";
import OpenCode from "@/components/codex/OpenCode";
import AshBurst from "@/components/fx/AshBurst";
import RuneButton from "@/components/ui/RuneButton";
import { useCodexSync } from "@/lib/codex-sync";
import { loadHojaRules } from "@/components/sheet/Hoja2024";
import { claimShelf, FARO_APP, tellFaro } from "@/lib/faro";
import { fichasNuevas } from "@/lib/faro-ficha";
import { useVault } from "@/lib/vault-store";

const CodexShelf = lazy(() => import("@/components/codex/shelf/CodexShelf"));

export default function Personajes() {
  const navigate = useNavigate();
  const { characters, burn, reforge } = useVault();
  const { account, accountsAvailable, status } = useCodexSync();
  const [query, setQuery] = useState("");
  const [burnOrigin, setBurnOrigin] = useState<{ x: number; y: number } | null>(null);
  const page = useRef<HTMLElement>(null);

  // Before the first sync, which waits a moment after the account is known.
  useEffect(() => {
    if (!account) return;
    const { characters: shelf, burned } = useVault.getState();
    const mine = claimShelf(account.id, { characters: shelf, burned });
    if (mine) useVault.setState({ ...mine, editingId: null });
  }, [account]);

  useEffect(() => {
    if (accountsAvailable !== null && !account) tellFaro({ sinSesion: true });
  }, [account, accountsAvailable]);

  /*
   * The account keeps each character's computed sheet so Discord can show it without a world. Once the shelf is
   * in step with the account, the profile says which versions it already holds and only the rest is computed.
   */
  const shelf = characters.map((entry) => `${entry.id}@${entry.sealedAt}`).join("|");
  useEffect(() => {
    if (!FARO_APP || status.state !== "done") return;
    let alive = true;
    const onMessage = (event: MessageEvent) => {
      const stored = event.data?.faro?.versiones;
      if (event.source !== window.parent || event.origin !== FARO_APP || !stored || typeof stored !== "object") return;
      const now = useVault.getState().characters;
      // El estante se dibuja primero; las fichas se calculan cuando ya pasó un rato y el navegador está libre.
      void new Promise<void>((done) => setTimeout(() => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(() => done(), { timeout: 5000 }) : done()), 2500))
        .then(() => loadHojaRules())
        .then((rules) => fichasNuevas(now, stored as Record<string, string>, rules))
        .then((fichas) => {
          if (alive) tellFaro({ fichas, ids: now.map((entry) => entry.id) });
        })
        .catch(() => undefined);
    };
    window.addEventListener("message", onMessage);
    tellFaro({ listo: true });
    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, [status.state, shelf]);

  useEffect(() => {
    document.documentElement.classList.add("en-faro");
    const node = page.current!;
    const observer = new ResizeObserver(() => tellFaro({ alto: Math.ceil(node.offsetHeight) }));
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("en-faro", "con-tomo");
    };
  }, []);

  const filtered = characters.filter((entry) => entry.state.characterName.toLowerCase().includes(query.toLowerCase()));
  const note =
    status.state === "failed"
      ? status.reason
      : status.state === "working"
        ? "Guardando…"
        : status.state === "done"
          ? "Guardado en tu cuenta."
          : "";

  return (
    <main ref={page} className="px-1 pb-6">
      {burnOrigin && <AshBurst origin={burnOrigin} onDone={() => setBurnOrigin(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-5 pb-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar personaje"
          className="w-56 border-b border-iron bg-transparent pb-2 font-body text-[15px] text-bone outline-none placeholder:text-bone focus:border-gold"
        />
        <p role="status" className="font-body text-[15px] text-bone">{note}</p>
        <Link to="/">
          <RuneButton variant="blood">Crear personaje</RuneButton>
        </Link>
      </div>

      {filtered.length > 0 ? (
        <Suspense fallback={<div className="h-[520px]" />}>
          <CodexShelf
            characters={filtered}
            onBurn={(id) => (origin) => {
              setBurnOrigin(origin);
              setTimeout(() => burn(id), 600);
            }}
            onReforge={(id) => () => {
              reforge(id);
              navigate("/forge");
            }}
            onOpenChange={(abierto) => {
              document.documentElement.classList.toggle("con-tomo", abierto);
              tellFaro({ abierto });
            }}
            noun={["personaje", "personajes"]}
          />
        </Suspense>
      ) : (
        <p className="py-16 text-center font-body text-lg text-bone">
          {characters.length === 0 ? "Todavía no tenés personajes." : "Ningún personaje con ese nombre."}
        </p>
      )}

      <details className="mt-6 border border-iron/40 px-5 py-4">
        <summary className="cursor-pointer font-mono text-[14px] uppercase tracking-[0.1em] text-gold">
          Agregar o respaldar
        </summary>
        <div className="pt-5">
          <OpenCode />
          <DropActor />
          <CodexBackup />
        </div>
      </details>
    </main>
  );
}
