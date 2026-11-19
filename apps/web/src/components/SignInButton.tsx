/**
 * The way in, offered where publishing just said no.
 *
 * Publishing a character needs a Discord account, so the refusal that says
 * "inicia sesion" has to come with somewhere to do it. Until now the sentence
 * was there and the button was not: it lived only on the Codex shelf, one
 * screen away from where the player had just been turned back.
 *
 * It returns to the page the player is on, query string included, so signing in
 * is a detour and not a restart: the Ritual comes back with its character
 * still chosen. The Worker accepts a path of this site and nothing else.
 */

import { signInUrl } from "@/lib/account-client";

function currentPath(): string {
  const { pathname, search } = globalThis.location ?? { pathname: "/codex", search: "" };
  return `${pathname}${search}`;
}

export default function SignInButton({ returnPath = currentPath() }: { returnPath?: string }) {
  return (
    <a
      href={signInUrl(returnPath)}
      className="inline-block border border-iron/50 px-4 py-2 font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:border-gold/50 hover:text-gold"
    >
      Entrar con Discord
    </a>
  );
}
