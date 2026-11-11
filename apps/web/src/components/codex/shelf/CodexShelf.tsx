import { useEffect, useMemo, useState } from "react";

import Tome from "@/components/codex/Tome";
import { BooksShowcase, type BookCfg } from "./BooksShowcase";
import { entryById } from "@/lib/catalog";
import { characterLevelFor, classingLabelFor } from "@/lib/builder";
import { tintFor } from "@/lib/class-tint";
import { sigilFor, type RoleSigil } from "@/lib/role-sigil";
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

/** The sigil in the middle of the cover: a dark medallion, the role's glyph lit from within. */
function paintSigil(x: CanvasRenderingContext2D, sigil: RoleSigil, cx: number, cy: number, radius: number) {
  x.save();
  x.beginPath();
  x.arc(cx, cy, radius, 0, Math.PI * 2);
  x.fillStyle = "rgba(0,0,0,0.72)";
  x.fill();
  x.lineWidth = 8;
  x.strokeStyle = sigil.color;
  x.stroke();
  x.globalAlpha = 0.4;
  x.lineWidth = 3;
  x.beginPath();
  x.arc(cx, cy, radius - 18, 0, Math.PI * 2);
  x.stroke();
  x.globalAlpha = 1;

  const scale = (radius * 1.25) / 512;
  x.translate(cx - 256 * scale, cy - 256 * scale);
  x.scale(scale, scale);
  x.shadowColor = sigil.color;
  x.shadowBlur = 40;
  x.fillStyle = sigil.color;
  x.strokeStyle = sigil.core;
  x.lineWidth = 6;
  for (const d of sigil.paths) {
    const path = new Path2D(d);
    x.fill(path);
    x.globalAlpha = 0.55;
    x.stroke(path);
    x.globalAlpha = 1;
  }
  x.restore();
}

/** `drawImage` source rectangle that fills the cover from the middle of the picture. */
function coverRect(image: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  return [(image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh] as const;
}

/**
 * The cover: the player's picture when there is one (otherwise black leather),
 * darkened toward the bottom for the name, with the role sigil in the middle.
 */
function paintFront(accent: string, sigil: RoleSigil, name: string, line: string, picture?: HTMLImageElement) {
  return (x: CanvasRenderingContext2D, w: number, h: number) => {
    const bg = x.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#2a2118");
    bg.addColorStop(0.55, "#171310");
    bg.addColorStop(1, "#000000");
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    if (picture) {
      const [sx, sy, sw, sh] = coverRect(picture, w, h);
      x.drawImage(picture, sx, sy, sw, sh, 0, 0, w, h);
      const shade = x.createLinearGradient(0, h * 0.45, 0, h);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.88)");
      x.fillStyle = shade;
      x.fillRect(0, 0, w, h);
    }

    x.strokeStyle = accent;
    x.globalAlpha = 0.55;
    x.lineWidth = 6;
    x.strokeRect(48, 48, w - 96, h - 96);
    x.lineWidth = 2;
    x.strokeRect(70, 70, w - 140, h - 140);
    x.globalAlpha = 1;

    paintSigil(x, sigil, w / 2, h * 0.38, 190);

    x.textAlign = "center";
    x.shadowColor = "rgba(0,0,0,0.9)";
    x.shadowBlur = 18;
    x.fillStyle = "#FFFFFF";
    x.font = `700 88px ${SERIF}`;
    const lines = wrap(x, name, w - 220);
    const top = h - 150 - lines.length * 100;
    lines.forEach((text, i) => x.fillText(text, w / 2, top + i * 100));
    x.fillStyle = accent;
    x.font = `600 44px ${SERIF}`;
    x.fillText(line, w / 2, h - 110);
    x.shadowBlur = 0;
  };
}

function bookFor(character: SealedCharacter, picture?: HTMLImageElement): BookCfg {
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
    front: paintFront(accent, sigilFor(state.classId), state.characterName, `Nivel ${level}`, picture),
    spineBg: "#0B0B0B",
    spineInk: accent,
    spineFont: `700 42px ${SERIF}`,
    backBg: "#0B0B0B",
    backInk: "255,255,255",
    edge: "#d8cfb8",
  };
}

/** Decodes every cover picture; `null` while any is still loading. A broken one is skipped. */
function usePictures(characters: SealedCharacter[]): Map<string, HTMLImageElement> | null {
  const key = characters.map((entry) => `${entry.id}:${entry.state.coverImage.length}`).join("|");
  const [loaded, setLoaded] = useState<{ key: string; map: Map<string, HTMLImageElement> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const map = new Map<string, HTMLImageElement>();
    void Promise.all(
      characters
        .filter((entry) => entry.state.coverImage)
        .map(
          (entry) =>
            new Promise<void>((resolve) => {
              const image = new Image();
              image.onload = () => {
                map.set(entry.id, image);
                resolve();
              };
              image.onerror = () => resolve();
              image.src = entry.state.coverImage;
            }),
        ),
    ).then(() => {
      if (!cancelled) setLoaded({ key, map });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loaded?.key === key ? loaded.map : null;
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
  const pictures = usePictures(characters);
  // The 3D scene is built once per set of books, so wait for the pictures
  // rather than build it, then build it again when they arrive.
  const books = useMemo(
    () => (pictures ? characters.map((entry) => bookFor(entry, pictures.get(entry.id))) : []),
    [characters, pictures],
  );
  const [open, setOpen] = useState<string | null>(null);
  const openCharacter = characters.find((entry) => entry.id === open);

  return (
    <>
      <div className="relative h-[56vh] max-h-[620px] min-h-[380px] w-full">
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
