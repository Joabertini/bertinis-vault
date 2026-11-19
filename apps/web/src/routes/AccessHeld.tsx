import { Link } from "react-router-dom";

/**
 * Where a registration lands when it was held for review.
 *
 * Said plainly and without an accusation: the check is automatic, it can be wrong, and the person
 * reading this is as likely to be a new player as anything else. The Codex still works without an
 * account, so nothing here is a dead end.
 *
 * The appeal (a text box that reaches the people who run the site) comes with the channel it will be
 * sent to; until then this says what happened and what is still possible.
 */
export default function AccessHeld() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-bone">
      <Link to="/codex" className="font-mono text-[13px] uppercase tracking-[0.1em] text-gold">
        ← Ir al Códice
      </Link>
      <h1 className="mt-8 font-display text-3xl font-bold text-white">Tu cuenta quedó en revisión</h1>
      <p className="mt-4 font-body text-[17px] leading-relaxed">
        Para publicar personajes pedimos una cuenta de Discord, y a las cuentas nuevas las revisa una
        persona antes de dejarlas entrar. Es un chequeo automático y puede equivocarse.
      </p>
      <p className="mt-4 font-body text-[17px] leading-relaxed">
        Mientras tanto, el Códice sigue funcionando: podés armar y guardar personajes en este
        navegador sin cuenta.
      </p>
    </main>
  );
}
