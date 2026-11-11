import { useMemo, useState } from "react";

import Tome from "@/components/codex/Tome";
import { BooksShowcase, type BookCfg } from "./BooksShowcase";
import { entryById } from "@/lib/catalog";
import { characterLevelFor, classingLabelFor } from "@/lib/builder";
import { tintFor } from "@/lib/class-tint";
import { rulesVersionOf, type SealedCharacter } from "@/lib/vault-store";

/**
 * The Codex shelf: every sealed character as a 3D book, VengeanceUI's
 * BooksShowcase with this project's palette. Loaded lazily by the Codex route
 * because it brings three.js with it.
 */

const SERIF = '"Cinzel", "EB Garamond", serif';

function wrap(x: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && x.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** The cover: black leather, a thin rule in the class colour, the name. */
function paintFront(accent: string, name: string, line: string) {
  return (x: CanvasRenderingContext2D, w: number, h: number) => {
    const bg = x.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#2a2118");
    bg.addColorStop(0.55, "#171310");
    bg.addColorStop(1, "#000000");
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = accent;
    x.globalAlpha = 0.55;
    x.lineWidth = 6;
    x.strokeRect(48, 48, w - 96, h - 96);
    x.lineWidth = 2;
    x.strokeRect(70, 70, w - 140, h - 140);

    x.fillStyle = accent;
    x.beginPath();
    x.arc(w / 2, h * 0.3, 70, 0, Math.PI * 2);
    x.globalAlpha = 0.18;
    x.fill();
    x.globalAlpha = 0.9;
    x.lineWidth = 4;
    x.stroke();
    x.globalAlpha = 1;

    x.textAlign = "center";
    x.fillStyle = "#FFFFFF";
    x.font = `700 92px ${SERIF}`;
    const lines = wrap(x, name, w - 220);
    lines.forEach((text, i) => x.fillText(text, w / 2, h * 0.52 + i * 104));
    x.fillStyle = accent;
    x.font = `600 46px ${SERIF}`;
    x.fillText(line, w / 2, h * 0.52 + lines.length * 104 + 40);
  };
}

function bookFor(character: SealedCharacter): BookCfg {
  const { state } = character;
  const accent = tintFor(state.classId);
  const rulesVersion = rulesVersionOf(state);
  const classLine = classingLabelFor(
    state,
    (classId) => entryById("class", rulesVersion, classId)?.label ?? classId,
  );
  const race = entryById("race", rulesVersion, state.raceId)?.label ?? "";
  const level = characterLevelFor(state);
  return {
    id: character.id,
    title: state.characterName,
    author: [race, classLine].filter(Boolean).join(" · "),
    year: `Nivel ${level}`,
    stars: 0,
    desc: `${classLine || "Sin clase"}${race ? `, ${race}` : ""}. Nivel ${level}.`,
    front: paintFront(accent, state.characterName, `Nivel ${level}`),
    spineBg: "#0B0B0B",
    spineInk: accent,
    spineFont: `700 42px ${SERIF}`,
    backBg: "#0B0B0B",
    backInk: "255,255,255",
    edge: "#d8cfb8",
  };
}

export default function CodexShelf({
  characters,
  onBurn,
  onReforge,
}: {
  characters: SealedCharacter[];
  onBurn: (id: string) => (origin: { x: number; y: number }) => void;
  onReforge: (id: string) => () => void;
}) {
  const books = useMemo(() => characters.map(bookFor), [characters]);
  const [open, setOpen] = useState<string | null>(null);
  const openCharacter = characters.find((entry) => entry.id === open);

  return (
    <>
      <div className="relative h-[78vh] min-h-[560px] w-full">
        <BooksShowcase
          books={books}
          heroTitle="Códice"
          navTitle={`${characters.length} ${characters.length === 1 ? "tomo" : "tomos"}`}
          className="!font-display"
          themeColors={{
            navy: "#0B0B0B",
            pink: "#F2C14E",
            cream: "#FFFFFF",
            lav: "#FFFFFF",
            peri: "#F2C14E",
            bg: "transparent",
            foregroundLight: "#FFFFFF",
            foregroundDark: "#FFFFFF",
          }}
          renderActions={(book) =>
            book ? (
              <button
                onClick={() => setOpen(book.id)}
                className="border border-[#F2C14E] bg-[#17120A] px-10 py-4 font-display text-[15px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#241C0D] hover:text-[#F2C14E]"
              >
                Abrir el tomo
              </button>
            ) : null
          }
        />
      </div>
      {openCharacter && (
        <Tome
          detached
          character={openCharacter}
          onBurn={onBurn(openCharacter.id)}
          onReforge={onReforge(openCharacter.id)}
          onDismiss={() => setOpen(null)}
        />
      )}
    </>
  );
}
