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

import ShareButton from "@/components/codex/ShareButton";
import Sigil from "@/components/sigils/Sigil";
import Vision from "@/components/codex/Vision";
import CharacterSheet from "@/components/sheet/CharacterSheet";
import FloatingWindow from "@/components/ui/FloatingWindow";
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
  const [view, setView] = useState<"closed" | "menu" | "hoja" | "vision">("closed");
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
        onClick={() => setView("menu")}
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
              background: `linear-gradient(to right, ${accent}cc, ${accent}55, #0B0B0B)`,
              transform: "rotateY(-90deg) translateX(-8px)",
              transformOrigin: "left center",
            }}
          />
          {/* cover */}
          <div
            className="absolute inset-0 border"
            style={{
              borderColor: `${accent}55`,
              background: "linear-gradient(150deg, #2a2118 0%, #171310 55%, #000000 100%)",
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
              <p className="line-clamp-2 text-center font-display text-[15px] font-bold leading-tight tracking-wide text-bone">
                {state.characterName}
              </p>
              <p className="font-mono text-[13px] uppercase tracking-[0.1em]" style={{ color: accent }}>
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
              className="absolute bottom-3 left-3 font-mono text-[13px] uppercase tracking-widest text-transparent transition-colors group-hover:text-gold"
            >
              ✦ enviar
            </Link>
          </div>
        </motion.div>

        <div className="absolute -bottom-3 left-2 right-2 h-3 bg-black/60 blur-md" />
      </motion.button>

      <AnimatePresence>
        {view === "menu" && (
          <TomeMenu
            character={character}
            accent={accent}
            className={classLine}
            onPick={setView}
            onClose={() => setView("closed")}
            onBurn={(origin) => {
              setView("closed");
              onBurn(origin);
            }}
            onReforge={onReforge}
          />
        )}

        {(view === "hoja" || view === "vision") && (
          <TomeWindow
            character={character}
            accent={accent}
            hitDie={hitDieFor(state.classId, rulesVersion)}
            className={classLine}
            view={view}
            onSwitch={setView}
            onClose={() => setView("closed")}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ================= the choice the tome opens onto ================= */

/**
 * Two ways to read the same character, and the tome asks which.
 *
 * The sheet is what a player fills in and checks; the cheat sheet is what they
 * reach for mid-combat. Neither is a subset of the other, and opening straight
 * into one of them makes the other feel hidden — which is what the shelf did
 * for as long as the tome opened onto the Vision and nothing else.
 */
function TomeMenu({
  character,
  accent,
  className,
  onPick,
  onClose,
  onBurn,
  onReforge,
}: {
  character: SealedCharacter;
  accent: string;
  className: string;
  onPick: (view: "hoja" | "vision") => void;
  onClose: () => void;
  onBurn: (origin: { x: number; y: number }) => void;
  onReforge: () => void;
}) {
  const { state } = character;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
        style={{ borderColor: `${accent}44`, boxShadow: `0 30px 70px rgba(0,0,0,0.8)` }}
        className="w-full max-w-lg border bg-[#000000] p-8"
      >
        <div className="flex items-center gap-4">
          <Sigil name={state.classId || state.raceId} size={40} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold text-bone">
              {state.characterName}
            </p>
            <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">
              Nivel {characterLevelFor(state)} · {className}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <MenuChoice
            accent={accent}
            title="La hoja"
            blurb="Todo el personaje, en el reparto de siempre."
            onClick={() => onPick("hoja")}
          />
          <MenuChoice
            accent={accent}
            title="Los recordatorios"
            blurb="Lo que se mira en medio de un combate."
            onClick={() => onPick("vision")}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-iron/30 pt-5">
          <button
            onClick={onClose}
            className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-bone"
          >
            ← Cerrar
          </button>

          <div className="flex flex-wrap items-start gap-5">
            <button
              onClick={onReforge}
              className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-bone"
              title="Volver a abrir este personaje en la fragua"
            >
              ⚒ Reforjar
            </button>
            {/* The link, without the ceremony. The Ritual keeps the crossing. */}
            <ShareButton character={character} accent={accent} />
            <Link
              to={`/ritual?id=${character.id}`}
              className="font-mono text-[14px] uppercase tracking-[0.1em] text-gold transition-colors hover:text-ember"
            >
              ✦ Enviar →
            </Link>
            <BurnButton onConfirm={onBurn} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MenuChoice({
  accent,
  title,
  blurb,
  onClick,
}: {
  accent: string;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ borderColor: `${accent}44` }}
      className="border bg-ash/50 px-5 py-4 text-left transition-colors hover:bg-ash"
    >
      <p className="font-display text-base font-bold" style={{ color: accent }}>
        {title}
      </p>
      <p className="mt-1 font-body text-[15px] leading-snug text-bone">{blurb}</p>
    </button>
  );
}

/* ================= open book ================= */

/* ================= the window the choice opens ================= */

/**
 * Whichever view was picked, in a window that behaves like a table's.
 *
 * Both views live in the same window, and the switch is in it rather than back
 * in the menu: the two answer different questions about the same character,
 * and a player who wants the other one wants it *now*, not after closing and
 * reopening the book.
 */
function TomeWindow({
  character,
  accent,
  hitDie,
  className,
  view,
  onSwitch,
  onClose,
}: {
  character: SealedCharacter;
  accent: string;
  hitDie: number | null;
  className: string;
  view: "hoja" | "vision";
  onSwitch: (view: "hoja" | "vision") => void;
  onClose: () => void;
}) {
  const { state } = character;

  const rulesVersion = rulesVersionOf(state);
  const resolved = useMemo(() => resolveDraft(state), [state]);
  /**
   * A sealed character reached the last chamber, so it has a species, a class
   * and a background and always derives. A tome stored by an older build might
   * not, and dashes are better than a crash.
   */
  const snapshot = resolved.status === "ready" ? resolved.snapshot : null;

  // The cheat sheet, narrowed to this character. Cheap enough to build on
  // open: it is lookups and filters over data already in the bundle.
  const playbook = useMemo(
    () => playbookFor(state, snapshot, rulesVersion),
    [state, snapshot, rulesVersion],
  );

  const race = entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
  // La cheatsheet la muestra como una píldora al lado de la de la clase.
  const subclass = entryById(
    "subclass",
    rulesVersion,
    state.subclassId,
    state.sourceBooks[`subclass:${state.subclassId}`],
  );
  const background = entryById(
    "background",
    rulesVersion,
    state.backgroundId,
    state.sourceBooks[`background:${state.backgroundId}`],
  );

  const subtitle = `Nivel ${characterLevelFor(state)} · ${race?.label ?? "—"} · ${className}${
    background ? ` · ${background.label}` : ""
  }`;

  return (
    <FloatingWindow
      title={state.characterName}
      subtitle={subtitle}
      accent={accent}
      width={view === "hoja" ? 1040 : 900}
      onClose={onClose}
    >
      <div className="flex items-center gap-4 border-b border-iron/30 px-6 py-2">
        {(
          [
            ["hoja", "La hoja"],
            ["vision", "Recordatorios"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => onSwitch(id)}
            style={{
              color: view === id ? accent : undefined,
              borderColor: view === id ? accent : "transparent",
            }}
            className={`border-b-2 pb-1 font-mono text-[14px] uppercase tracking-[0.1em] transition-colors ${
              view === id ? "" : "text-bone hover:text-bone"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "hoja" ? (
        snapshot ? (
          <CharacterSheet state={state} build={snapshot} accent={accent} />
        ) : (
          <p className="px-8 py-10 font-body text-[15px] text-bone">
            Este tomo no se puede derivar: le falta especie, clase o trasfondo. Reforjalo y
            terminalo para ver la hoja.
          </p>
        )
      ) : (
        <>
          <Vision
            playbook={playbook}
            classId={state.classId}
            className={className}
            subclassLabel={subclass?.label ?? null}
            name={state.characterName}
            subtitle={subtitle}
          />

          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-iron/30 px-8 py-5 font-mono text-sm">
            {hitDie && <Row k="Dado de golpe" v={`d${hitDie}`} />}
            <Row k="Reglas" v={rulesVersion} />
            <Row k="Sellado" v={new Date(character.sealedAt).toLocaleDateString()} />
          </dl>
        </>
      )}
    </FloatingWindow>
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
      <dt className="uppercase tracking-widest text-bone">{k}</dt>
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
        className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-ember"
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
      <span className="font-mono text-[13px] uppercase tracking-widest text-ember">
        No se puede deshacer.
      </span>
      <button
        onClick={(event) => onConfirm({ x: event.clientX, y: event.clientY })}
        className="border border-blood/70 bg-blood/25 px-6 py-2 font-display text-[14px] font-bold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-blood/60"
      >
        Quemar
      </button>
      <button
        onClick={() => setArming(false)}
        className="font-mono text-[14px] uppercase tracking-widest text-bone hover:text-bone"
      >
        Perdonar
      </button>
    </motion.div>
  );
}
