/**
 * Dropping a Foundry character onto the shelf.
 *
 * The Vault could always send a character out to Foundry and never take one
 * back. A player with characters already living in a campaign had to rebuild
 * them here by hand, or not have them here at all.
 *
 * What arrives is the `.json` Foundry writes when you export an actor. It is
 * read, resolved against the index and shelved — see `foundry-import.ts` for
 * why the join is exact rather than a name match.
 *
 * Nothing is shelved silently. What resolved and what did not are both shown,
 * because an import that quietly loses a species is worse than one that says
 * it could not place it, and because the player is the only one who can tell
 * whether what came through is the character they meant.
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { readFoundryActor, type ActorImport } from "@/lib/foundry-import";
import { useVault } from "@/lib/vault-store";

type Outcome =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "failed"; reason: string }
  | { kind: "read"; name: string; report: ActorImport };

export default function DropActor() {
  const { admit } = useVault();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function take(file: File | undefined) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setOutcome({
        kind: "failed",
        reason: `"${file.name}" no es un .json. Foundry exporta el personaje como json desde la ficha.`,
      });
      return;
    }

    setOutcome({ kind: "reading" });

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setOutcome({ kind: "failed", reason: "El archivo no es json valido." });
      return;
    }

    const report = readFoundryActor(raw);
    if (!report) {
      setOutcome({
        kind: "failed",
        // The commonest wrong file is a monster or an NPC, which look very
        // similar until you check `type`.
        reason: "Es un json, pero no un personaje de Foundry. Un monstruo o un PNJ no sirven.",
      });
      return;
    }

    admit(report.state);
    setOutcome({ kind: "read", name: report.state.characterName, report });
  }

  return (
    <div className="mb-14">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void take(event.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") input.current?.click();
        }}
        className="cursor-pointer border border-dashed px-6 py-7 text-center transition-colors"
        style={{
          borderColor: over ? "#F2C14E" : "rgba(74,70,64,0.6)",
          background: over ? "rgba(176,138,62,0.06)" : "transparent",
        }}
      >
        <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-gold">
          Traer de Foundry
        </p>
        <p className="mt-2 font-body text-[15px] text-bone">
          Solta aca el json que exporta Foundry.
        </p>

        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            void take(event.target.files?.[0]);
            // Cleared so choosing the same file twice fires the change again.
            event.target.value = "";
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {outcome.kind === "failed" && (
          <motion.p
            key="failed"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 border-l-2 border-ember/60 pl-3 font-body text-[15px] text-bone"
          >
            {outcome.reason}
          </motion.p>
        )}

        {outcome.kind === "read" && (
          <motion.div
            key="read"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-iron/50 bg-void/40 p-5"
          >
            <p className="font-display text-[15px] font-bold text-gold">
              {outcome.name} esta en el estante
            </p>

            <div className="mt-3 grid gap-x-8 gap-y-1 md:grid-cols-2">
              {outcome.report.resolved.map((line) => (
                <p key={line} className="font-body text-sm text-bone">
                  <span className="text-gold">·</span> {line}
                </p>
              ))}
            </div>

            {/* Named, not swallowed. These are the parts the player has to
                pick again by hand in the Forge. */}
            {outcome.report.unresolved.length > 0 && (
              <div className="mt-4 border-t border-iron/40 pt-3">
                <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-ember">
                  {outcome.report.unresolved.length} sin reconocer
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {outcome.report.unresolved.map((line) => (
                    <p key={line} className="font-body text-[15px] text-bone">
                      {line}
                    </p>
                  ))}
                </div>
                <p className="mt-2 font-body text-[15px] text-bone">
                  El indice no los conoce. El resto entro igual.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
