/**
 * The Codex — the shelf of sealed characters.
 *
 * Unchanged from the design: the wooden plank, the scrying lens, the ash burst
 * when a tome burns. The tomes themselves now hold real builds.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Tome from "@/components/codex/Tome";
import DropActor from "@/components/codex/DropActor";
import AshBurst from "@/components/fx/AshBurst";
import EmberField from "@/components/fx/EmberField";
import GrainOverlay from "@/components/fx/GrainOverlay";
import RuneButton from "@/components/ui/RuneButton";
import AccountBadge from "@/components/codex/AccountBadge";
import CodexBackup from "@/components/codex/CodexBackup";
import { useVault } from "@/lib/vault-store";
import { PAGE } from "@/styles/recipes";

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
      <EmberField density={30} />

      {burnOrigin && <AshBurst origin={burnOrigin} onDone={() => setBurnOrigin(null)} />}

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-10">
        <header className="mb-4">
          <Link
            to="/"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60 transition-colors hover:text-gold"
          >
            ← El umbral
          </Link>
          <p className="mt-6 font-mono text-[10px] tracking-[0.6em] uppercase text-gold/85">
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
          <p className="max-w-md font-body text-lg italic leading-relaxed text-bone/75">
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
                className="w-56 border-b border-iron bg-transparent pb-2 pl-8 font-body text-sm text-bone outline-none transition-colors placeholder:text-bone/45 focus:border-gold"
              />
              <svg
                className="absolute left-0 top-0 h-4 w-4 text-gold/85"
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

        {/* Above the shelves, and shown even when they are empty: an empty
            Codex is exactly when a player most wants to bring characters in
            rather than start from nothing. */}
        <DropActor />

        <CodexBackup />

        {characters.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <p className="py-24 text-center font-body text-xl italic text-bone/75">
            Ningun tomo con ese nombre.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-10 gap-y-16 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, filter: "blur(6px)" }}
                    transition={{ delay: index * 0.06, duration: 0.5 }}
                    className="flex justify-center"
                  >
                    <Tome
                      character={entry}
                      onBurn={handleBurn(entry.id)}
                      onReforge={handleReforge(entry.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="mt-[-8px] h-3 w-full bg-gradient-to-b from-[#2a2118] via-[#1a140e] to-[#0c0a08] shadow-[0_10px_30px_rgba(0,0,0,0.7)]" />
          </>
        )}
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
      <p className="mt-8 font-display text-2xl font-bold text-bone/80">
        Tu codice espera a su primer heroe.
      </p>
      <Link to="/" className="mt-10 inline-block">
        <RuneButton variant="gold">Empezar la forja</RuneButton>
      </Link>
    </motion.div>
  );
}
