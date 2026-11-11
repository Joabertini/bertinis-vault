/**
 * A tome someone else built, opened by its code.
 *
 * The same ten characters that Foundry imports also open the character here.
 * What arrives is the builder state, not the derived sheet — a sheet cannot be
 * edited back into choices, so the store keeps both and this page reads the
 * half the builder needs. See `vault-client.ts`.
 *
 * Taking a copy is a fork and not a mirror: it lands in this Codex with its own
 * id, and nothing it does afterwards reaches the character it came from. That
 * is the point rather than a limitation — a DM fixing a sheet must not mutate
 * the player's tome under them, and the corrected version travels back the same
 * way it came, as a new code.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import Vision from "@/components/codex/Vision";
import EmberField from "@/components/fx/EmberField";
import GrainOverlay from "@/components/fx/GrainOverlay";
import RuneButton from "@/components/ui/RuneButton";
import { characterLevelFor, classingLabelFor } from "@/lib/builder";
import { coerceBuilderState } from "@/lib/builder-state";
import { entryById } from "@/lib/catalog";
import { tintFor } from "@/lib/class-tint";
import { resolveDraft } from "@/lib/derive";
import { playbookFor } from "@/lib/playbook";
import { VaultRequestError, fetchBuild } from "@/lib/vault-client";
import { rulesVersionOf, useVault } from "@/lib/vault-store";
import { PAGE } from "@/styles/recipes";
import type { BuilderState } from "@/lib/builder-state";

type Phase =
  | { kind: "reading" }
  /** The code resolved and carries a state this builder can open. */
  | { kind: "open"; state: BuilderState }
  /**
   * The code exists but predates shared states, or was posted straight to the
   * store. It still imports into Foundry, and saying so is more use than an
   * empty tome.
   */
  | { kind: "foundryOnly"; characterName: string }
  | { kind: "lost"; reason: string };

export default function SharedTome() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { admit, reforge } = useVault();
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const build = await fetchBuild(code);
        if (cancelled) return;

        if (!build.state || typeof build.state !== "object") {
          setPhase({
            kind: "foundryOnly",
            characterName: build.payload?.identity?.characterName ?? "",
          });
          return;
        }

        // Coerced through the same path a stored draft takes, because this
        // state was written by another machine on another version of the app.
        setPhase({ kind: "open", state: coerceBuilderState(build.state) });
      } catch (error) {
        if (cancelled) return;
        setPhase({
          kind: "lost",
          reason:
            error instanceof VaultRequestError
              ? error.message
              : "No se pudo alcanzar el almacen. Revisa la conexion.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  /** Keep the copy and open it on the anvil. The original is untouched. */
  const takeAndEdit = (state: BuilderState) => {
    const id = admit(state);
    reforge(id);
    navigate("/forge");
  };

  /** Keep it on the shelf without interrupting whatever is being forged. */
  const takeOnly = (state: BuilderState) => {
    admit(state);
    setTaken(true);
  };

  return (
    <main className={PAGE}>
      <GrainOverlay />
      <EmberField density={20} />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-10">
        <header className="mb-8">
          <Link
            to="/"
            className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
          >
            ← El umbral
          </Link>
          <p className="mt-6 font-mono text-[13px] tracking-[0.1em] uppercase text-gold">
            Un tomo prestado
          </p>
          <p className="mt-2 font-mono text-sm tracking-[0.1em] text-bone">{code}</p>
        </header>

        {phase.kind === "reading" && (
          <p className="font-body text-[15px] text-bone">Buscando el tomo…</p>
        )}

        {phase.kind === "lost" && (
          <div className="max-w-xl">
            <p className="font-display text-2xl font-black text-bone">Ese codigo no abrio nada</p>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-bone">{phase.reason}</p>
            <div className="mt-8">
              <Link to="/codex">
                <RuneButton variant="gold">Ir al Codice</RuneButton>
              </Link>
            </div>
          </div>
        )}

        {phase.kind === "foundryOnly" && (
          <div className="max-w-xl">
            <p className="font-display text-2xl font-black text-bone">
              {phase.characterName || "Ese personaje"} solo viaja a Foundry
            </p>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-bone">
              Ese codigo se creo antes de que un tomo se pudiera abrir acá, asi que trae la
              ficha ya calculada y no las decisiones que la produjeron. Importa en Foundry sin
              problema. Para abrirlo acá, pedile a quien lo armo que lo envie de nuevo por el
              portal: el codigo nuevo sirve para las dos cosas.
            </p>
          </div>
        )}

        {phase.kind === "open" && (
          <OpenSharedTome
            state={phase.state}
            taken={taken}
            onTakeAndEdit={() => takeAndEdit(phase.state)}
            onTakeOnly={() => takeOnly(phase.state)}
          />
        )}
      </div>
    </main>
  );
}

function OpenSharedTome({
  state,
  taken,
  onTakeAndEdit,
  onTakeOnly,
}: {
  state: BuilderState;
  taken: boolean;
  onTakeAndEdit: () => void;
  onTakeOnly: () => void;
}) {
  const rulesVersion = rulesVersionOf(state);
  const accent = tintFor(state.classId);

  const resolved = useMemo(() => resolveDraft(state), [state]);
  // A tome built by an older version of the builder may not derive. Dashes
  // beat a crash on a page whose whole job is to show someone else's work.
  const snapshot = resolved.status === "ready" ? resolved.snapshot : null;
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
  const className = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div
        className="border"
        style={{
          borderColor: `${accent}44`,
          background: "#000000",
          boxShadow: `0 40px 80px rgba(0,0,0,0.8), inset 0 0 80px ${accent}08`,
        }}
      >
        <Vision
          playbook={playbook}
          classId={state.classId}
          className={className}
          subclassLabel={
            entryById(
              "subclass",
              rulesVersion,
              state.subclassId,
              state.sourceBooks[`subclass:${state.subclassId}`],
            )?.label ?? null
          }
          name={state.characterName}
          subtitle={`Nivel ${characterLevelFor(state)} · ${race?.label ?? "—"} · ${className}${
            background ? ` · ${background.label}` : ""
          }`}
        />
      </div>

      <div className="mt-8 max-w-2xl">
        <p className="font-body text-[15px] leading-relaxed text-bone">
          Podes quedarte una copia y editarla. Es tuya desde ese momento: lo que cambies no
          toca el personaje de quien te paso el codigo, y lo que esa persona cambie despues no
          llega a tu copia. Para devolver una correccion, envia tu copia por el portal y pasa
          el codigo nuevo.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-6">
          <RuneButton variant="gold" onClick={onTakeAndEdit}>
            ⚒ Quedarme una copia y editarla
          </RuneButton>
          <button
            onClick={onTakeOnly}
            disabled={taken}
            className="font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-bone disabled:text-bone/30"
          >
            {taken ? "✓ guardado en tu Codice" : "Guardar sin editar"}
          </button>
          {taken && (
            <Link
              to="/codex"
              className="font-mono text-[14px] uppercase tracking-[0.1em] text-gold transition-colors hover:text-ember"
            >
              Ir al Codice →
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
