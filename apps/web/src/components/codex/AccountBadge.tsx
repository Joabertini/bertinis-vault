/**
 * Whose Codex this is.
 *
 * Small on purpose. The shelf works signed out and always has: the account is
 * an offer — carry these somewhere else — not a gate, and a sign-in wall over
 * a builder nobody has to register for would be asking for a favour before
 * doing one.
 *
 * Nothing here appears when the store keeps no accounts. A deployment that
 * only hands out import codes is a whole service on its own, and offering to
 * sign into it would be offering something that answers 501.
 */

import { signInUrl } from "@/lib/account-client";
import { useCodexSync } from "@/lib/codex-sync";
import { WHISPER } from "@/styles/recipes";

export default function AccountBadge() {
  const { account, status, signOut } = useCodexSync();

  if (!account) {
    return (
      <div className="flex flex-col items-end gap-1">
        <a
          href={signInUrl("/codex")}
          className="border border-iron/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/50 transition-colors hover:border-gold/50 hover:text-gold"
        >
          Entrar con Discord
        </a>
        <p className={WHISPER}>Para que el Codice te siga a otra maquina.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {account.avatarUrl && (
          <img
            src={account.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full border border-iron/50"
          />
        )}
        <span className="font-body text-sm text-bone/60">{account.displayName}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/30 transition-colors hover:text-ember"
        >
          Salir
        </button>
      </div>

      <p className={WHISPER}>{noteFor(status)}</p>
    </div>
  );
}

/**
 * What the sync just did, said in full including the nothings.
 *
 * "Nada que traer" is an answer; a blank line under somebody's name is not.
 */
function noteFor(status: ReturnType<typeof useCodexSync>["status"]): string {
  if (status.state === "working") return "Sincronizando…";
  if (status.state === "failed") return status.reason;

  if (status.state === "done") {
    const parts = [
      status.added > 0 ? `${status.added} nuevo${status.added === 1 ? "" : "s"}` : "",
      status.updated > 0 ? `${status.updated} actualizado${status.updated === 1 ? "" : "s"}` : "",
    ].filter(Boolean);

    return parts.length > 0 ? `Sincronizado: ${parts.join(", ")}.` : "Sincronizado. Nada que traer.";
  }

  return "El Codice se sincroniza solo.";
}
