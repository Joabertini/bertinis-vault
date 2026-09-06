/**
 * Someone else's code, typed into the shelf.
 *
 * The link a player is passed goes straight to the tome, and this is the same
 * door for the code that arrived without one — read aloud at a table, or
 * dictated over voice. Nothing is validated here beyond "something was typed":
 * the store already knows how to forgive case, spacing and the characters
 * people substitute, and a second opinion in the page would only be a second
 * place for the two to disagree.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OpenCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const open = () => {
    const typed = code.trim();
    if (typed) navigate(`/tomo/${encodeURIComponent(typed.toUpperCase())}`);
  };

  return (
    <div className="mb-10 flex flex-wrap items-end gap-4 border border-iron/40 bg-ash/40 px-6 py-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/85">
          Abrir un tomo prestado
        </p>
        <p className="mt-1 font-body text-sm text-bone/60">
          Pega el codigo que te pasaron. Podes quedarte una copia y editarla.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") open();
          }}
          placeholder="ABCDE-12345"
          aria-label="Codigo del tomo"
          className="w-48 border-b border-iron bg-transparent pb-2 font-mono text-sm uppercase tracking-[0.2em] text-bone outline-none transition-colors placeholder:text-bone/45 focus:border-gold"
        />
        <button
          onClick={open}
          disabled={code.trim() === ""}
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold transition-colors hover:text-ember disabled:text-bone/30"
        >
          Abrir →
        </button>
      </div>
    </div>
  );
}
