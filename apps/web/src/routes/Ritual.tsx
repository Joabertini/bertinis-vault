/**
 * The Ritual — sending a sealed character somewhere.
 *
 * Five realms, all of them listed. Three cross for real:
 *
 *   Foundry VTT     POSTs the payload to the Worker and returns the code the
 *                   module reads. This is the path the whole project is built
 *                   around, so it is the one the circle actually channels.
 *   Raw Grimoire    downloads the same payload as JSON.
 *   Parchment Sheet opens a printable sheet.
 *
 * The other two are drawn and dormant. A dormant realm says why rather than
 * failing quietly, because "not yet" is information and a dead button is not.
 */

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import EmberField from "@/components/fx/EmberField";
import GlyphScramble from "@/components/fx/GlyphScramble";
import GrainOverlay from "@/components/fx/GrainOverlay";
import SummoningCircle from "@/components/fx/SummoningCircle";
import Sigil from "@/components/sigils/Sigil";
import RuneButton from "@/components/ui/RuneButton";

import { entryById } from "@/lib/catalog";
import { characterLevelFor, classingLabelFor } from "@/lib/builder";
import { tintFor } from "@/lib/class-tint";
import { resolveDraft } from "@/lib/derive";
import {
  REALMS,
  downloadPayloadJson,
  printCharacterSheet,
  realmById,
  type Realm,
  type RealmId,
} from "@/lib/export-targets";
import { VaultRequestError, publishBuild } from "@/lib/vault-client";
import { rulesVersionOf, useVault } from "@/lib/vault-store";
import { PAGE } from "@/styles/recipes";

type Phase =
  | { kind: "select" }
  | { kind: "channeling" }
  | { kind: "arrived"; code?: string }
  | { kind: "refused"; reason: string };

export default function Ritual() {
  const [params] = useSearchParams();
  const { characters } = useVault();
  const characterId = params.get("id");

  const character = useMemo(
    () => characters.find((entry) => entry.id === characterId) ?? characters[0],
    [characters, characterId],
  );

  const [realmId, setRealmId] = useState<RealmId | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "select" });
  const [copied, setCopied] = useState(false);

  const resolved = useMemo(
    () => (character ? resolveDraft(character.state) : null),
    [character],
  );

  if (!character || !resolved) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-void px-6 text-center">
        <GrainOverlay />
        <p className="font-body text-xl italic text-bone/50">
          Ningun alma esta atada a este ritual.
        </p>
        <Link to="/codex">
          <RuneButton variant="gold">Volver al Codice</RuneButton>
        </Link>
      </main>
    );
  }

  const { state } = character;
  const rulesVersion = rulesVersionOf(state);
  const accent = tintFor(state.classId);
  const cls = entryById("class", rulesVersion, state.classId);
  // "Guerrero 5 / Mago 3" when there is more than one class, and just the
  // class's name when there is not.
  const classLine = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );

  const realm = realmById(realmId);

  const beginRitual = async () => {
    if (!realm) return;

    if (realm.status === "dormant") {
      setPhase({ kind: "refused", reason: realm.dormantReason ?? "Este reino todavia no recibe." });
      return;
    }

    if (resolved.status !== "ready") {
      setPhase({
        kind: "refused",
        reason: `Este personaje todavia no esta completo. Falta: ${resolved.missing.join(", ")}.`,
      });
      return;
    }

    if (!resolved.payload) {
      // Every blocking reason, not just the first: a character held back by
      // three unresolved picks would otherwise be fixed one refusal at a time.
      const shown = resolved.problems.slice(0, 3).join(" ");
      const rest = resolved.problems.length - 3;

      setPhase({
        kind: "refused",
        reason: shown
          ? rest > 0
            ? `${shown} Y ${rest} mas.`
            : shown
          : "Faltan datos obligatorios: linaje, clase o trasfondo no se pudieron resolver.",
      });
      return;
    }

    const { payload, snapshot } = resolved;
    setPhase({ kind: "channeling" });

    // The two local realms need no network, but the circle still turns: the
    // channel is the confirmation that something happened.
    if (realm.id === "json") {
      window.setTimeout(() => {
        downloadPayloadJson(payload);
        setPhase({ kind: "arrived" });
      }, 1400);
      return;
    }

    if (realm.id === "pdf") {
      window.setTimeout(() => {
        const opened = printCharacterSheet(snapshot);
        setPhase(
          opened
            ? { kind: "arrived" }
            : {
                kind: "refused",
                reason: "El navegador bloqueo la ventana de impresion. Permiti las ventanas emergentes.",
              },
        );
      }, 1400);
      return;
    }

    // Foundry: the payload goes to the Worker and comes back as a code.
    try {
      const published = await publishBuild(payload);
      setPhase({ kind: "arrived", code: published.code });
    } catch (error) {
      setPhase({
        kind: "refused",
        reason:
          error instanceof VaultRequestError
            ? error.message
            : "No se pudo alcanzar el almacen de builds. Revisa la conexion.",
      });
    }
  };

  const reset = () => {
    setPhase({ kind: "select" });
    setRealmId(null);
    setCopied(false);
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
  };

  return (
    <main className={PAGE}>
      <GrainOverlay />
      <EmberField density={35} />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:px-10">
        <header className="mb-14 text-center">
          <Link
            to="/codex"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/30 transition-colors hover:text-gold"
          >
            ← El codice
          </Link>
          <p className="mt-6 font-mono text-[10px] tracking-[0.6em] uppercase text-gold/60">
            Circulo de teletransportacion
          </p>
          <h1 className="mt-3 font-display text-5xl font-black tracking-wide text-bone">
            EL RITUAL
          </h1>
          <p className="mx-auto mt-4 max-w-md font-body italic text-bone/45">
            Elegi un reino de destino. El circulo hace el resto.
          </p>
        </header>

        {/* who is crossing */}
        <div className="mb-12 flex items-center justify-center gap-5 border border-iron/50 bg-ash/70 px-8 py-4 backdrop-blur-sm">
          <Sigil name={state.classId || state.raceId} size={34} />
          <div className="text-left">
            <p className="font-display text-lg font-bold text-bone">{state.characterName}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-bone/40">
              Nivel {characterLevelFor(state)} · {classLine || "—"} · reglas {rulesVersion}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ---------------- select ---------------- */}
          {phase.kind === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {REALMS.map((entry) => (
                  <PortalRune
                    key={entry.id}
                    realm={entry}
                    selected={realmId === entry.id}
                    onClick={() => setRealmId(entry.id)}
                  />
                ))}
              </div>

              {realm && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 text-center font-body italic text-bone/45"
                >
                  {realm.yields}.
                  {realm.status === "dormant" && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ember/70">
                      dormido
                    </span>
                  )}
                </motion.p>
              )}

              {/* An unresolvable pick would be dropped, so it is said up front. */}
              {resolved.status === "ready" && resolved.problems.length > 0 && (
                <Unresolved problems={resolved.problems} />
              )}

              <div className="mt-12 flex justify-center">
                <RuneButton
                  variant="blood"
                  onClick={beginRitual}
                  className={realm ? "" : "pointer-events-none opacity-30"}
                >
                  Comenzar el ritual
                </RuneButton>
              </div>
            </motion.div>
          )}

          {/* ---------------- channeling ---------------- */}
          {phase.kind === "channeling" && (
            <motion.div
              key="channeling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-10"
            >
              <SummoningCircle size={340} active={false} accent={accent} />
              <GlyphScramble
                text={`Transmutando ${state.characterName} hacia ${realm?.name ?? ""}`}
                className="text-xs tracking-[0.25em] text-ember"
              />
              <div className="h-px w-64 bg-iron">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.4, ease: "easeInOut" }}
                  className="h-full"
                  style={{ background: "#FF5A1F", boxShadow: "0 0 10px #FF5A1F" }}
                />
              </div>
            </motion.div>
          )}

          {/* ---------------- arrived ---------------- */}
          {phase.kind === "arrived" && (
            <motion.div
              key="arrived"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <SummoningCircle size={300} active accent={accent} />

              <motion.div
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <p className="font-display text-3xl font-black text-bone">
                  El cruce esta completo
                </p>
                <GlyphScramble
                  text={`${state.characterName} llego a ${realm?.name ?? ""}.`}
                  className="mt-3 block text-xs tracking-[0.2em] text-gold"
                />
              </motion.div>

              {/* The code is the whole point of the Foundry crossing. */}
              {phase.code && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="w-full max-w-md"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-bone/40">
                    Pega esto en el modulo
                  </p>

                  <button
                    onClick={() => copyCode(phase.code!)}
                    className="group mt-4 w-full border border-gold/60 bg-ash/80 px-6 py-6 transition-colors hover:border-gold"
                    style={{ boxShadow: "0 0 40px rgba(176,138,62,0.12)" }}
                    title="Copiar codigo"
                  >
                    <span className="block select-all font-mono text-3xl font-bold tracking-[0.35em] text-gold">
                      {phase.code}
                    </span>
                    <span className="mt-3 block font-mono text-[9px] uppercase tracking-[0.3em] text-bone/35 transition-colors group-hover:text-bone/60">
                      {copied ? "✓ copiado" : "click para copiar"}
                    </span>
                  </button>

                  <p className="mt-4 font-body text-sm italic leading-relaxed text-bone/35">
                    En Foundry: abri el modulo del Faro del Alba y escribi el codigo.
                    Plutonium resuelve cada referencia contra sus compendios.
                  </p>
                </motion.div>
              )}

              <div className="mt-2 flex flex-wrap justify-center gap-6">
                <button
                  onClick={reset}
                  className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/40 hover:text-bone"
                >
                  ↻ Lanzar de nuevo
                </button>
                <Link to="/codex">
                  <RuneButton variant="gold">Volver al Codice</RuneButton>
                </Link>
              </div>
            </motion.div>
          )}

          {/* ---------------- refused ---------------- */}
          {phase.kind === "refused" && (
            <motion.div
              key="refused"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <div className="opacity-40">
                <SummoningCircle size={260} active={false} accent="#6E0F0F" />
              </div>

              <div className="max-w-md">
                <p className="font-display text-2xl font-black text-bone">
                  El circulo no se abrio
                </p>
                <p className="mt-4 font-body italic leading-relaxed text-bone/50">
                  {phase.reason}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                <button
                  onClick={reset}
                  className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/40 hover:text-bone"
                >
                  ← Elegir otro reino
                </button>
                <Link to="/codex">
                  <RuneButton variant="ghost">Volver al Codice</RuneButton>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ================= unresolved picks ================= */

/**
 * What the export will leave behind, before it leaves it behind.
 *
 * A count alone — "2 elecciones sin resolver" — tells a player that something
 * is wrong and gives them no way to find out what, which is the same as not
 * telling them. The sentences are already written; they only needed somewhere
 * to appear.
 *
 * Folded shut by default: on a finished character this is usually empty, and
 * an open warning panel over a character with nothing wrong reads as an error.
 */
function Unresolved({ problems }: { problems: string[] }) {
  const [open, setOpen] = useState(false);
  const count = problems.length;

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <button
        onClick={() => setOpen((value) => !value)}
        className="mx-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ember/70 transition-colors hover:text-ember"
        aria-expanded={open}
      >
        <span>
          {count} {count === 1 ? "eleccion no cruza" : "elecciones no cruzan"}
        </span>
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {problems.map((problem) => (
              <li
                key={problem}
                className="mt-3 border-l-2 pl-4 font-body text-sm leading-relaxed text-bone/50"
                style={{ borderColor: "rgba(200, 80, 40, 0.5)" }}
              >
                {problem}
              </li>
            ))}
            <li className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/25">
              El resto del personaje cruza igual
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= portal rune ================= */

function PortalRune({
  realm,
  selected,
  onClick,
}: {
  realm: Realm;
  selected: boolean;
  onClick: () => void;
}) {
  const dormant = realm.status === "dormant";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex aspect-square flex-col items-center justify-center gap-3 border p-4 text-center transition-all duration-500"
      style={{
        borderColor: selected ? "#FF5A1F99" : "rgba(74,70,64,0.4)",
        background: selected ? "rgba(110,15,15,0.12)" : "rgba(18,16,13,0.8)",
        boxShadow: selected
          ? "0 0 30px rgba(255,90,31,0.15), inset 0 0 20px rgba(255,90,31,0.08)"
          : "none",
        opacity: dormant && !selected ? 0.55 : 1,
      }}
    >
      <motion.span
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: selected ? 8 : 30, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-1 border border-dashed"
        style={{ borderColor: selected ? "#FF5A1F55" : "rgba(74,70,64,0.27)" }}
      />

      {/* the eye — hollow while the realm sleeps */}
      <span
        className="relative block h-8 w-8 rounded-full border transition-all duration-500"
        style={{
          borderColor: selected ? "#FF5A1F" : dormant ? "#4A4640" : "#8a857c",
          boxShadow: selected
            ? "0 0 16px #FF5A1F66, inset 0 0 10px #FF5A1F44"
            : "inset 0 0 6px rgba(0,0,0,0.6)",
          background: selected
            ? "radial-gradient(circle, rgba(255,90,31,0.5), transparent 70%)"
            : dormant
              ? "transparent"
              : "radial-gradient(circle, rgba(74,70,64,0.4), transparent 70%)",
        }}
      />

      <span
        className="relative px-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.15em]"
        style={{ color: selected ? "#E6DFCE" : "rgba(230,223,206,0.33)" }}
      >
        {realm.name}
      </span>

      {dormant && (
        <span className="absolute bottom-2 font-mono text-[7px] uppercase tracking-[0.2em] text-bone/25">
          dormido
        </span>
      )}
    </motion.button>
  );
}
