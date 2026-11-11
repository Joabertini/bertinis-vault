/**
 * Taking the Codex with you.
 *
 * Two buttons, and the import is the careful one. It merges rather than
 * replaces, and it says what it did — an import that reports nothing looks
 * like an import that did nothing.
 *
 * The warning about `localStorage` that used to sit under them is gone: there
 * are accounts now, so a Codex that syncs is not a Codex that vanishes, and
 * the line had become false. A file is for carrying a Codex somewhere, not
 * for surviving the browser.
 */

import { useRef, useState } from "react";

import { exportCodex, readCodexFile } from "@/lib/codex-file";
import { useVault } from "@/lib/vault-store";
import { WHISPER } from "@/styles/recipes";

/** The file name a player will recognise a year from now. */
function fileName(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `codice-${today}.json`;
}

export default function CodexBackup() {
  const { characters, importCharacters } = useVault();
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = () => {
    const url = URL.createObjectURL(
      new Blob([exportCodex(characters)], { type: "application/json" }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    link.click();

    // Released on the next tick: revoking it immediately can cancel the
    // download in some browsers before it has started reading.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Guardados ${characters.length}.`);
  };

  const load = async (file: File) => {
    const read = readCodexFile(await file.text());

    if (!read.ok) {
      setNotice(read.reason);
      return;
    }

    const { added, updated, kept } = importCharacters(read.characters);

    // Said in full, including the nothings. "Nada nuevo" is an answer; a blank
    // line after picking a file is not.
    const parts = [
      added > 0 ? `${added} nuevo${added === 1 ? "" : "s"}` : "",
      updated > 0 ? `${updated} actualizado${updated === 1 ? "" : "s"}` : "",
      kept > 0 ? `${kept} que ya tenias mas nuevo${kept === 1 ? "" : "s"}` : "",
      read.skipped > 0 ? `${read.skipped} ilegible${read.skipped === 1 ? "" : "s"}` : "",
    ].filter(Boolean);

    setNotice(parts.length > 0 ? parts.join(", ") + "." : "Nada nuevo: ya los tenias todos.");
  };

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-iron/40 pt-6">
      <button
        type="button"
        onClick={save}
        disabled={characters.length === 0}
        className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold disabled:cursor-not-allowed disabled:text-bone"
      >
        Guardar el Codice en un archivo
      </button>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone transition-colors hover:text-gold"
      >
        Traer un Codice guardado
      </button>

      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Archivo del Codice"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the same file twice fires again: after a failed
          // import the natural next move is to try that file once more.
          event.target.value = "";
          if (file) void load(file);
        }}
      />

      {notice && <p className={WHISPER}>{notice}</p>}
    </div>
  );
}
