/**
 * One press, one link.
 *
 * Getting a code used to mean the Ritual: open it, pick Foundry among five
 * realms, watch the circle turn, read the code off the arrival screen. That is
 * the right amount of ceremony for sending a character across to a table and
 * far too much for answering "pasame el link" — three screens to copy one line.
 *
 * So this publishes the character where it stands and puts the address on the
 * clipboard. The code comes with it, because the two are read in different
 * places: the link goes in a chat, and the code is what somebody types into
 * Foundry or reads out at the table.
 *
 * Pressing it again is safe and is the point. The character keeps the code it
 * already has — see `share.ts` — so the link already pasted somewhere keeps
 * opening the current version instead of an evening-old one.
 */

import { useState } from "react";

import { shareCharacter } from "@/lib/share";
import { useVault, type SealedCharacter } from "@/lib/vault-store";

type Phase =
  | { kind: "idle" }
  | { kind: "sharing" }
  | { kind: "done"; code: string; link: string; copied: boolean }
  | { kind: "refused"; reason: string };

export default function ShareButton({
  character,
  accent,
}: {
  character: SealedCharacter;
  accent: string;
}) {
  const rememberShare = useVault((s) => s.rememberShare);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const share = async () => {
    if (phase.kind === "sharing") return;
    setPhase({ kind: "sharing" });

    const result = await shareCharacter(character.state, character.share);

    if (result.kind === "refused") {
      setPhase({ kind: "refused", reason: result.reason });
      return;
    }

    // Recorded before the clipboard, which can fail or be denied: a code the
    // Codex forgot would be minted again on the next press, and the link just
    // handed out would go stale.
    rememberShare(character.id, result.share);

    let copied = false;
    try {
      await navigator.clipboard?.writeText(result.link);
      copied = true;
    } catch {
      // Denied permission, an insecure origin, or a browser that has no
      // clipboard at all. The code is on screen either way.
    }

    setPhase({ kind: "done", code: result.code, link: result.link, copied });
  };

  const label =
    phase.kind === "sharing"
      ? "Compartiendo…"
      : character.share
        ? "🔗 Copiar el link"
        : "🔗 Compartir";

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={share}
        disabled={phase.kind === "sharing"}
        title="Publica este personaje y copia el link que lo abre"
        className="self-start font-mono text-[14px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-bone disabled:text-bone/30"
      >
        {phase.kind === "done" && phase.copied ? "✓ link copiado" : label}
      </button>

      {phase.kind === "done" && (
        <p className="font-mono text-[13px] tracking-[0.1em]" style={{ color: accent }}>
          {phase.code}
          {!phase.copied && (
            <span className="ml-2 tracking-normal text-bone/40 normal-case">
              — el navegador no dejo copiar; el codigo se puede tipear
            </span>
          )}
        </p>
      )}

      {phase.kind === "refused" && (
        <p className="max-w-md font-body text-[14px] leading-relaxed text-ember">
          {phase.reason}
        </p>
      )}
    </div>
  );
}
