/**
 * The Codex — the shelf of sealed characters.
 *
 * Unchanged from the design: the wooden plank, the scrying lens, the ash burst
 * when a tome burns. The tomes themselves now hold real builds.
 */

import { lazy, Suspense, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import DropActor from "@/components/codex/DropActor";
import OpenCode from "@/components/codex/OpenCode";
import AshBurst from "@/components/fx/AshBurst";
import LightfallBackdrop from "@/components/fx/LightfallBackdrop";
import GrainOverlay from "@/components/fx/GrainOverlay";
import RuneButton from "@/components/ui/RuneButton";
import AccountBadge from "@/components/codex/AccountBadge";
import CodexBackup from "@/components/codex/CodexBackup";
import { useVault } from "@/lib/vault-store";
import { PAGE } from "@/styles/recipes";

// three.js comes with the shelf, so it loads here and not with the landing.
const CodexShelf = lazy(() => import("@/components/codex/shelf/CodexShelf"));

export default function Codex() {
  const navigate = useNavigate();
  const { characters, burn, reforge } = useVault();
  const [burnOrigin, setBurnOrigin] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");

  const filtered = characters.filter((entry) =>
    entry.state.characterName.toLowerCase().includes(query.toLowerCase()),
  );

  /** The tome burns first, then falls out of the shelf as the ash settles. */
  const handleBurn = (id: string) => (origin: { x: number; y: number }) => {
    setBurnOrigin(origin);
    setTimeout(() => burn(id), 600);
  };

  /** Back to the anvil. Unlike "Forjar nuevo" this keeps the tome's identity. */
  const handleReforge = (id: string) => () => {
    reforge(id);
    navigate("/forge");
  };

  return (
    <main className={PAGE}>
      <GrainOverlay />
      <LightfallBackdrop variant="page" fallbackDensity={30} />

      {burnOrigin && <AshBurst origin={burnOrigin} onDone={() => setBurnOrigin(null)} />}

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-10">
        <header className="mb-4">
          <Link
            to="/"
            className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
          >
            ← El umbral
          </Link>
          <p className="mt-6 font-mono text-[13px] tracking-[0.1em] uppercase text-gold">
            El archivo de abajo
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <h1 className="font-display text-5xl font-black tracking-wide text-bone md:text-6xl">
              EL CODICE
            </h1>
            <AccountBadge />
          </div>
        </header>

        <div className="mb-14 flex flex-wrap items-end justify-between gap-6 border-b border-iron/40 pb-8">
          <p className="max-w-md font-body text-lg italic leading-relaxed text-bone">
            {characters.length === 0
              ? "Los estantes estan vacios."
              : `${characters.length} ${characters.length === 1 ? "alma" : "almas"} en pena entre tus estantes.`}
          </p>

          <div className="flex items-center gap-6">
            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre…"
                aria-label="Buscar personaje"
                className="w-56 border-b border-iron bg-transparent pb-2 pl-8 font-body text-[15px] text-bone outline-none transition-colors placeholder:text-bone focus:border-gold"
              />
              <svg
                className="absolute left-0 top-0 h-4 w-4 text-gold"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="10" cy="10" r="6" />
                <path d="M15 15l6 6" />
              </svg>
            </div>
            <Link to="/">
              <RuneButton variant="blood">Forjar nuevo</RuneButton>
            </Link>
          </div>
        </div>

        {/* The shelf is the page: full width, above the tools. */}
        {filtered.length > 0 && (
          <div className="relative left-1/2 mb-14 w-screen -translate-x-1/2">
            <Suspense fallback={<div className="h-[78vh] min-h-[560px]" />}>
              <CodexShelf characters={filtered} onBurn={handleBurn} onReforge={handleReforge} />
            </Suspense>
          </div>
        )}

        {/* Below the shelf, and shown even when it is empty: an empty
            Codex is exactly when a player most wants to bring characters in
            rather than start from nothing. */}
        <OpenCode />

        <DropActor />

        <CodexBackup />

        {characters.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <p className="py-24 text-center font-body text-xl italic text-bone">
            Ningun tomo con ese nombre.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1 }}
      className="mx-auto max-w-lg py-28 text-center"
    >
      <svg
        className="mx-auto h-16 w-16 text-gold/30"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M48 8C34 14 20 30 14 46l-4 10 10-4C36 46 50 30 56 16z" />
        <path d="M20 42l14-14M26 48l14-14" strokeWidth="1" />
      </svg>
      <p className="mt-8 font-display text-2xl font-bold text-bone">
        Tu codice espera a su primer heroe.
      </p>
      <Link to="/" className="mt-10 inline-block">
        <RuneButton variant="gold">Empezar la forja</RuneButton>
      </Link>
    </motion.div>
  );
}
