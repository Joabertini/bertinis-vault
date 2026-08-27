/**
 * A sealed character, as a book on the shelf.
 *
 * The 3D cover, the spine, the page-flip and the burn ritual are the design
 * unchanged. The content is not.
 *
 * What the book opens onto is not a book. The two-page spread was the design
 * and it was the wrong shape for what now goes inside it: the Vision — the
 * cheat sheet narrowed to this one character — reads as a wide page, and a
 * folio turned every note into a column that wrapped twice beside a facing
 * page of whitespace. So the spread, its page-flip and its second folio are
 * gone, and the shelf keeps everything that made it worth keeping.
 *
 * The numbers on that page are read off the derived build, which is the same
 * object the Foundry export sends, so an open tome and an export can never
 * disagree. See `playbook.ts` and `Vision.tsx`.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Sigil from "@/components/sigils/Sigil";
import Vision from "@/components/codex/Vision";
import { playbookFor } from "@/lib/playbook";
import { entryById, hitDieFor } from "@/lib/catalog";
import { characterLevelFor, classingLabelFor } from "@/lib/builder";
import { tintFor } from "@/lib/class-tint";
import { resolveDraft } from "@/lib/derive";
import { rulesVersionOf, type SealedCharacter } from "@/lib/vault-store";

export default function Tome({
  character,
  onBurn,
  onReforge,
}: {
  character: SealedCharacter;
  onBurn: (origin: { x: number; y: number }) => void;
  /** Put this character back on the anvil. Re-sealing overwrites this tome. */
  onReforge: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { state } = character;
  const accent = tintFor(state.classId);

  const rulesVersion = rulesVersionOf(state);
  const cls = entryById("class", rulesVersion, state.classId);
  // "Guerrero 5 / Mago 3" when there is more than one class, and just the
  // class's name when there is not.
  const classLine = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );


  return (
    <>
      {/* ---------- closed, on the shelf ---------- */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover="hover"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative h-56 w-40 [perspective:1200px]"
        aria-label={`Abrir ${state.characterName}`}
      >
        <motion.div
          variants={{ hover: { rotateY: -18, x: 14, z: 30 } }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-full w-full"
        >
          {/* page edge */}
          <div
            className="absolute right-0 top-[3px] h-[calc(100%-6px)] w-[10px]"
            style={{
              background: "repeating-linear-gradient(to right, #d8cfb8 0px, #d8cfb8 1px, #a89e86 2px)",
              transform: "translateX(9px) rotateY(90deg)",
              transformOrigin: "left center",
            }}
          />
          {/* spine */}
          <div
            className="absolute left-0 top-0 h-full w-[16px]"
            style={{
              background: `linear-gradient(to right, ${accent}cc, ${accent}55, #12100D)`,
              transform: "rotateY(-90deg) translateX(-8px)",
              transformOrigin: "left center",
            }}
          />
          {/* cover */}
          <div
            className="absolute inset-0 border"
            style={{
              borderColor: `${accent}55`,
              background: "linear-gradient(150deg, #2a2118 0%, #171310 55%, #0c0a08 100%)",
              boxShadow: `inset -6px 0 12px rgba(0,0,0,0.6), inset 4px 0 8px ${accent}22`,
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.7' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />

            <div className="flex h-full flex-col items-center justify-center gap-5 px-4">
              <Sigil name={state.classId || state.raceId} size={52} />
              <span className="h-px w-10 bg-current opacity-40" style={{ color: accent }} />
              <p className="line-clamp-2 text-center font-display text-sm font-bold leading-tight tracking-wide text-bone">
                {state.characterName}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: accent }}>
                Nivel {characterLevelFor(state)}
              </p>
            </div>

            {/* corner rivets */}
            {(
              [
                ["top-1.5", "left-1.5"],
                ["top-1.5", "right-1.5"],
                ["bottom-1.5", "left-1.5"],
                ["bottom-1.5", "right-1.5"],
              ] as const
            ).map(([vertical, horizontal]) => (
              <span
                key={`${vertical}-${horizontal}`}
                className={`absolute ${vertical} ${horizontal} h-1.5 w-1.5 rounded-full`}
                style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
              />
            ))}

            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ boxShadow: `inset 0 0 40px ${accent}33, 0 0 50px ${accent}22` }}
            />

            {/* the shortcut straight to the portal */}
            <Link
              to={`/ritual?id=${character.id}`}
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-3 left-3 font-mono text-[9px] uppercase tracking-widest text-transparent transition-colors group-hover:text-gold"
            >
              ✦ enviar
            </Link>
          </div>
        </motion.div>

        <div className="absolute -bottom-3 left-2 right-2 h-3 bg-black/60 blur-md" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <OpenTome
            character={character}
            accent={accent}
            hitDie={hitDieFor(state.classId, rulesVersion)}
            className={classLine}
            onClose={() => setOpen(false)}
            onBurn={(origin) => {
              setOpen(false);
              onBurn(origin);
            }}
            onReforge={onReforge}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ================= open book ================= */

function OpenTome({
  character,
  accent,
  hitDie,
  className,
  onClose,
  onBurn,
  onReforge,
}: {
  character: SealedCharacter;
  accent: string;
  hitDie: number | null;
  className: string;
  onClose: () => void;
  onBurn: (origin: { x: number; y: number }) => void;
  onReforge: () => void;
}) {
  const { state } = character;

  const rulesVersion = rulesVersionOf(state);
  const resolved = useMemo(() => resolveDraft(state), [state]);
  /**
   * A sealed character reached the last chamber, so it has a species, a class
   * and a background and always derives. A tome stored by an older build might
   * not, and a folio of dashes is better than a crash.
   */
  const snapshot = resolved.status === "ready" ? resolved.snapshot : null;

  // The cheat sheet, narrowed to this character. Cheap enough to build on
  // open: it is lookups and filters over data already in the bundle.
  const playbook = useMemo(
    () => playbookFor(state, snapshot, rulesVersion),
    [state, snapshot, rulesVersion],
  );

  const race = entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
  const background = entryById(
    "background",
    rulesVersion,
    state.backgroundId,
    state.sourceBooks[`background:${state.backgroundId}`],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.94, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-6xl"
      >
        {/*
          The page the book opens onto.
          Wide, and its own scroll — the play notes run past a screen for most
          classes, and the alternative is either a shrunken column or a modal
          that grows taller than the window it sits in.
        */}
        <div
          className="max-h-[82vh] overflow-y-auto border"
          style={{
            borderColor: `${accent}44`,
            background: "#0c0a08",
            boxShadow: `0 40px 80px rgba(0,0,0,0.8), inset 0 0 80px ${accent}08`,
          }}
        >
          <Vision
            playbook={playbook}
            accent={accent}
            name={state.characterName}
            subtitle={`Nivel ${characterLevelFor(state)} · ${race?.label ?? "—"} · ${className}${
              background ? ` · ${background.label}` : ""
            }`}
            sigilName={state.classId || state.raceId}
          />

          {/* Who the player said this was, in their own words. Kept at the
              foot: it is the part they wrote, not the part they play from. */}
          {(state.trait || state.ideal || state.bond || state.flaw) && (
            <div className="grid gap-4 border-t border-iron/30 px-8 py-6 md:grid-cols-2">
              {(
                [
                  ["Rasgo", state.trait],
                  ["Ideal", state.ideal],
                  ["Vinculo", state.bond],
                  ["Defecto", state.flaw],
                ] as const
              ).map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-bone/30">
                      {label}
                    </p>
                    <p className="mt-0.5 font-body text-sm italic leading-snug text-bone/55">
                      {value}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-iron/30 px-8 py-5 font-mono text-xs">
            {hitDie && <Row k="Dado de golpe" v={`d${hitDie}`} />}
            <Row k="Reglas" v={rulesVersion} />
            <Row k="Sellado" v={new Date(character.sealedAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/40 transition-colors hover:text-bone"
          >
            ← Cerrar el tomo
          </button>

          <div className="flex items-center gap-6">
            <button
              onClick={onReforge}
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/40 transition-colors hover:text-bone"
              title="Volver a abrir este personaje en la fragua"
            >
              ⚒ Reforjar
            </button>
            <Link
              to={`/ritual?id=${character.id}`}
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold transition-colors hover:text-ember"
            >
              ✦ Enviar por el portal →
            </Link>
            <BurnButton onConfirm={onBurn} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * One fact in the strip along the foot of the page.
 *
 * Inline rather than a bordered row: these sit in a wrapping line now, where
 * a `justify-between` pair would stretch each label away from its own value.
 */
function Row({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="uppercase tracking-widest text-bone/30">{k}</dt>
      <dd style={{ color: accent ?? "#8a857c" }}>{v}</dd>
    </div>
  );
}

/* ================= burn ritual ================= */

function BurnButton({ onConfirm }: { onConfirm: (origin: { x: number; y: number }) => void }) {
  const [arming, setArming] = useState(false);

  if (!arming) {
    return (
      <button
        onClick={() => setArming(true)}
        className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/30 transition-colors hover:text-ember"
      >
        Quemar este tomo
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-ember/80">
        No se puede deshacer.
      </span>
      <button
        onClick={(event) => onConfirm({ x: event.clientX, y: event.clientY })}
        className="border border-blood/70 bg-blood/25 px-6 py-2 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-bone transition-colors hover:bg-blood/60"
      >
        Quemar
      </button>
      <button
        onClick={() => setArming(false)}
        className="font-mono text-[11px] uppercase tracking-widest text-bone/40 hover:text-bone"
      >
        Perdonar
      </button>
    </motion.div>
  );
}
