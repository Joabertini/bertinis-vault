/**
 * Dibuja la cheatsheet a un archivo, para poder mirarla en un navegador.
 *
 * Igual que `hoja-render.ts`, y por la misma razón: lo único que dice si una
 * pantalla quedó bien es abrirla. Escribe HTML estático, sin interacción — la
 * pestaña que se ve es la primera.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import Vision from "@/components/codex/Vision";
import { initialState, characterLevelFor, type BuilderState } from "@/lib/builder";
import { entryById } from "@/lib/catalog";
import { resolveDraft } from "@/lib/derive";
import { playbookFor } from "@/lib/playbook";
import { rulesVersionOf } from "@/lib/vault-store";

const state: BuilderState = {
  ...initialState,
  characterName: "Kaelen Thorne",
  raceId: "human",
  subraceId: "",
  classId: "fighter",
  subclassId: "battle-master",
  backgroundId: "soldier",
  weaponId: "longsword",
  str: 16,
};

const rulesVersion = rulesVersionOf(state);
const resolved = resolveDraft(state);
const snapshot = resolved.status === "ready" ? resolved.snapshot : null;
const race = entryById("race", rulesVersion, state.raceId, state.sourceBooks[`race:${state.raceId}`]);
const subclass = entryById(
  "subclass",
  rulesVersion,
  state.subclassId,
  state.sourceBooks[`subclass:${state.subclassId}`],
);

const markup = renderToStaticMarkup(
  createElement(Vision, {
    playbook: playbookFor(state, snapshot, rulesVersion),
    classId: state.classId,
    className: "Guerrero",
    subclassLabel: subclass?.label ?? null,
    name: state.characterName,
    subtitle: `Nivel ${characterLevelFor(state)} · ${race?.label ?? "—"} · Guerrero`,
  }),
);

writeFileSync(
  join(process.cwd(), "public", "hoja", "vision.html"),
  `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#111}</style></head><body>${markup}</body></html>`,
  "utf8",
);
console.log("vision.html escrito");
