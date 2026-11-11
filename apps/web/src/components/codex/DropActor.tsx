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

import { coverFromPortrait, fitCoverImage } from "@/lib/cover-image";
import { readFoundryActor, type ActorImport } from "@/lib/foundry-import";
import { useVault } from "@/lib/vault-store";

type Outcome =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "failed"; reason: string }
  | {
      kind: "read";
      id: string;
      name: string;
      report: ActorImport;
      /** Whether the book already has a picture. */
      covered: boolean;
      /** Set when a picture was refused, so the player is told rather than left guessing. */
      coverProblem?: string;
    };

export default function DropActor() {
  const { admit, setCover } = useVault();
  const input = useRef<HTMLInputElement>(null);
  const pictureInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  /**
   * Whatever was dropped: the actor's `.json`, and optionally its picture.
   *
   * A Foundry export only names its picture by a path inside the server's Data
   * folder — the bytes are not in the file — so the picture can come along as a
   * second file in the same drop, or afterwards from the notice below.
   */
  async function takeMany(files: File[]) {
    const picture = files.find((file) => file.type.startsWith("image/"));
    const file = files.find((candidate) => candidate.name.toLowerCase().endsWith(".json"));
    if (!file && picture && outcome.kind === "read") return attach(picture);
    await take(file ?? files[0], picture);
  }

  async function attach(picture: File) {
    if (outcome.kind !== "read") return;
    try {
      setCover(outcome.id, await fitCoverImage(picture));
      const { coverProblem: _cleared, ...rest } = outcome;
      setOutcome({ ...rest, covered: true });
    } catch (error) {
      setOutcome({ ...outcome, coverProblem: error instanceof Error ? error.message : "No pude usar esa imagen." });
    }
  }

  async function take(file: File | undefined, picture?: File) {
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

    // The picture, in the order it can be had: a file dropped with the json,
    // then what the actor itself carries (a data URL, or a URL this page may
    // read). A path inside Foundry's Data folder needs the file, asked for
    // below.
    let coverImage = "";
    let coverProblem: string | undefined;
    if (picture) {
      try {
        coverImage = await fitCoverImage(picture);
      } catch (error) {
        coverProblem = error instanceof Error ? error.message : "No pude usar esa imagen.";
      }
    }
    if (!coverImage) coverImage = (await coverFromPortrait(report.portrait)) ?? "";

    const id = admit({ ...report.state, coverImage });
    setOutcome({
      kind: "read",
      id,
      name: report.state.characterName,
      report,
      covered: Boolean(coverImage),
      ...(coverProblem ? { coverProblem } : {}),
    });
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
          void takeMany([...event.dataTransfer.files]);
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
          Solta aca el json que exporta Foundry. Si querés su imagen, soltala junto.
        </p>

        <input
          ref={input}
          type="file"
          accept=".json,application/json,image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void takeMany([...(event.target.files ?? [])]);
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

            {/* The picture: taken on its own when the file carries it, asked for
                when it only names a path inside Foundry's Data folder. */}
            {outcome.covered ? (
              <p className="mt-3 font-body text-sm text-bone">
                <span className="text-gold">·</span> Imagen de la tapa tomada
              </p>
            ) : (
              <div className="mt-4 border-t border-iron/40 pt-3">
                <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-gold">Imagen de la tapa</p>
                <p className="mt-1.5 font-body text-[15px] text-bone">
                  {outcome.report.portrait
                    ? `El json solo dice dónde está la imagen en tu Foundry (${decodeURI(outcome.report.portrait)}); no trae la imagen. Elegila y queda de tapa.`
                    : "Este personaje no trae imagen. Podés elegir una para la tapa."}
                </p>
                <button
                  type="button"
                  onClick={() => pictureInput.current?.click()}
                  className="mt-2 border border-gold bg-[#17120A] px-5 py-2 font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-[#241C0D] hover:text-gold"
                >
                  Elegir imagen
                </button>
              </div>
            )}
            {outcome.coverProblem && (
              <p role="alert" className="mt-2 font-body text-[15px] text-ember">
                {outcome.coverProblem}
              </p>
            )}
            <input
              ref={pictureInput}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Elegir imagen para la tapa"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) void attach(picked);
                event.target.value = "";
              }}
            />

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
