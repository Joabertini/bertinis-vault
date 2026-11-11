/**
 * The Gate.
 *
 * The landing: cinematic bars, god rays, embers.
 *
 * The design's monolith d20 is gone. Its inner facet was drawn on points that
 * do not mirror about the centre — 138/70 on one axis, 130/62 on the other —
 * so it read as a dented hexagon rather than as a die, and at 720px behind
 * the wordmark there was nowhere for that to hide.
 *
 * The one thing it now asks is which edition. That question has to be answered
 * before the Forge opens, because the ruleset decides which books are legal
 * and therefore which species and classes even exist — a character cannot be
 * half-built and then switched without re-resolving every pick.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

import CinematicIntro from "@/components/fx/CinematicIntro";
import EmberField from "@/components/fx/EmberField";
import GrainOverlay from "@/components/fx/GrainOverlay";
import Sigil from "@/components/sigils/Sigil";
import RuneButton from "@/components/ui/RuneButton";
import { hasProgress, useVault } from "@/lib/vault-store";
import type { BuilderRulesVersion } from "@/lib/builder-state";
import { PAGE } from "@/styles/recipes";

export default function Gate() {
  return (
    <CinematicIntro>
      <GateContent />
    </CinematicIntro>
  );
}

function GateContent() {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { beginDraft, characters, draft } = useVault();
  const [choosing, setChoosing] = useState(false);
  // The edition picked, while the supplements question is still open.
  const [edition, setEdition] = useState<BuilderRulesVersion | null>(null);
  const inProgress = hasProgress(draft);

  // Horizontal travel went with the monolith; the title still drifts with the
  // pointer's vertical position, which is the whole of the parallax now.
  const my = useMotionValue(0);
  const sy = useSpring(my, { stiffness: 40, damping: 20 });

  const { scrollYProgress } = useScroll();
  const fogY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const titleY = useTransform(sy, [-0.5, 0.5], [14, -14]);

  const enterForge = (rulesVersion: BuilderRulesVersion, supplements: boolean) => {
    beginDraft(rulesVersion, supplements);
    navigate("/forge");
  };

  const close = () => {
    setChoosing(false);
    setEdition(null);
  };

  // A full-screen overlay that only closes by clicking outside traps anyone
  // working from the keyboard.
  useEffect(() => {
    if (!choosing) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing]);

  return (
    <main
      ref={ref}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        my.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      className={PAGE}
    >
      <GrainOverlay />
      <EmberField density={60} />

      {/* God rays from above */}
      <motion.div
        animate={{ opacity: [0.05, 0.09, 0.05] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="pointer-events-none absolute -top-40 left-1/2 h-[80vh] w-[60vw] -translate-x-1/2"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 40%, rgba(176,138,62,0.5) 49%, rgba(230,223,206,0.6) 50%, rgba(176,138,62,0.5) 51%, transparent 60%)",
          filter: "blur(30px)",
          maskImage: "linear-gradient(to bottom, black, transparent 75%)",
        }}
      />

      {/* Ground fog */}
      <motion.div style={{ y: fogY }} className="pointer-events-none absolute bottom-0 h-64 w-full">
        <div className="h-full w-full bg-gradient-to-t from-[#0a0806] via-[#0a0806]/40 to-transparent blur-xl" />
      </motion.div>

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.p
          style={{ y: titleY }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 1.4 }}
          className="font-mono text-[10px] tracking-[0.7em] uppercase text-gold"
        >
          El codice de personajes
        </motion.p>

        <motion.h1
          // Letter-spacing this wide eats the word space: at 8xl, "DEL ALBA"
          // closes up into one word unless the gap is widened to match.
          style={{ y: titleY, wordSpacing: "0.22em" }}
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.5, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 font-title text-7xl font-normal leading-[0.95] tracking-wide text-bone drop-shadow-[0_0_40px_rgba(176,138,62,0.15)] md:text-9xl"
        >
          Faro
          <br />
          <span className="bg-gradient-to-b from-[#B08A3E] via-[#8a6a2e] to-[#4d3a18] bg-clip-text text-transparent">
            del Alba
          </span>
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="my-10 flex w-72 items-center gap-4"
        >
          <span className="h-px flex-1 bg-gradient-to-l from-gold/60 to-transparent" />
          <Sigil name="fighter" size={22} className="text-gold" />
          <span className="h-px flex-1 bg-gradient-to-r from-gold/60 to-transparent" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {/* Offered first when there is work on the anvil: pressing the other
              button would replace it, and habit reaches for the big one. */}
          {inProgress && (
            <RuneButton variant="gold" onClick={() => navigate("/forge")}>
              Retomar la forja
            </RuneButton>
          )}
          <RuneButton variant="blood" onClick={() => setChoosing(true)}>
            {inProgress ? "Empezar otro" : "Forjar un heroe"}
          </RuneButton>
          <Link to="/codex">
            <RuneButton variant="ghost">Abrir el Codice</RuneButton>
          </Link>
        </motion.div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 flex flex-wrap justify-center gap-12 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60"
        >
          <span>
            Heroes sellados — <b className="text-gold">{characters.length}</b>
          </span>
          <span>Reinos enlazados — 5</span>
          <span>Ediciones — 2014 · 2024</span>
        </motion.footer>
      </section>

      {/* ---------- the edition portal ---------- */}
      <AnimatePresence>
        {choosing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[85] flex items-center justify-center bg-black/88 px-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-3xl text-center"
            >
              <p className="font-mono text-[10px] tracking-[0.6em] uppercase text-gold/85">
                Dos puertas, un umbral
              </p>
              <h2 className="mt-4 font-display text-3xl font-black tracking-wide text-bone md:text-4xl">
                ¿BAJO QUE REGLAS?
              </h2>
              <p className="mx-auto mt-4 max-w-md font-body italic text-bone/75">
                Decide que libros son legales. No se cambia a mitad de la forja.
              </p>

              {/* Said before the click, not after: choosing an edition here
                  replaces whatever is on the anvil, and there is no undo. */}
              {inProgress && (
                <p className="mx-auto mt-5 max-w-md border-l-2 border-ember/60 pl-4 text-left font-body text-sm leading-relaxed text-bone/75">
                  Hay una forja en curso
                  {draft.characterName.trim() ? ` — ${draft.characterName.trim()}` : ""}. Elegir
                  una edicion aca la descarta.
                </p>
              )}

              {edition === null ? (
                <div className="mt-12 grid gap-6 sm:grid-cols-2">
                  <EditionDoor
                    edition="2014"
                    title="Quinta edicion"
                    detail="Player's Handbook 2014. Nueve linajes, doce clases."
                    onClick={() => setEdition("5e-2014")}
                  />
                  <EditionDoor
                    edition="2024"
                    title="Reglas revisadas"
                    detail="Player's Handbook 2024. Diez linajes, trasfondos que dan la mejora de aptitud."
                    onClick={() => setEdition("5e-2024")}
                  />
                </div>
              ) : (
                <div className="mt-12">
                  <p className="font-display text-xl font-bold uppercase tracking-[0.2em] text-bone">
                    ¿Usan libros complementarios?
                  </p>
                  <div className="mt-8 grid gap-6 sm:grid-cols-2">
                    <EditionDoor
                      edition="Sí"
                      title="Con suplementos"
                      detail={
                        edition === "5e-2024"
                          ? "Además del Player's Handbook 2024: Tasha's, Xanathar's, Fizban's, Eberron, Strixhaven, Monsters of the Multiverse y el resto."
                          : "Además del Player's Handbook: Tasha's, Xanathar's, Fizban's, Eberron, Strixhaven, Monsters of the Multiverse y el resto."
                      }
                      onClick={() => enterForge(edition, true)}
                    />
                    <EditionDoor
                      edition="No"
                      title="Solo los básicos"
                      detail={
                        edition === "5e-2024"
                          ? "Player's Handbook, Dungeon Master's Guide y Monster Manual 2024."
                          : "Player's Handbook, Dungeon Master's Guide y Monster Manual 2014."
                      }
                      onClick={() => enterForge(edition, false)}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => (edition === null ? close() : setEdition(null))}
                className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/60 transition-colors hover:text-bone"
              >
                {edition === null ? "← Volver" : "← Elegir otra edicion"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function EditionDoor({
  edition,
  title,
  detail,
  onClick,
}: {
  edition: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.97 }}
      className="group relative overflow-hidden border border-iron/60 bg-ash/80 p-8 text-left transition-colors duration-500 hover:border-gold/70"
    >
      <motion.span
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full border border-dashed border-gold/20"
      />

      <p className="font-display text-5xl font-black text-gold transition-colors group-hover:text-gold">
        {edition}
      </p>
      <p className="mt-3 font-display text-sm font-bold uppercase tracking-[0.25em] text-bone">
        {title}
      </p>
      <p className="mt-3 font-body text-sm leading-relaxed text-bone/60">{detail}</p>

      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </motion.button>
  );
}
