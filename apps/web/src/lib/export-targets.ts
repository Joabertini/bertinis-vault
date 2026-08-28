/**
 * Where a sealed character can be sent.
 *
 * Every realm a player might want is listed, including the ones that do not
 * work yet. A destination that is missing from the list looks unsupported;
 * one that is present and marked dormant looks planned, which is the truth.
 */

import type { CharacterBuild, ImportPayload } from "@bertinis-vault/contracts";

import { abilityLabels } from "./builder";

export type RealmStatus =
  /** Crosses for real, right now. */
  | "open"
  /** Named, drawn, and not yet channelling. */
  | "dormant";

export type RealmId = "foundry" | "json" | "pdf" | "dndbeyond" | "roll20";

export type Realm = {
  id: RealmId;
  name: string;
  /** What the player gets, in one line. */
  yields: string;
  status: RealmStatus;
  /** Shown when a dormant realm is chosen, in place of a silent failure. */
  dormantReason?: string;
};

export const REALMS: Realm[] = [
  {
    id: "foundry",
    name: "Foundry VTT",
    yields: "Un codigo que se pega en el modulo",
    status: "open",
  },
  {
    id: "json",
    name: "Raw Grimoire",
    yields: "El payload de importacion, en JSON",
    status: "open",
  },
  {
    id: "pdf",
    name: "Parchment Sheet",
    yields: "Hoja imprimible, lista para la mesa",
    status: "open",
  },
  {
    id: "dndbeyond",
    name: "D&D Beyond",
    yields: "Ficha en tu cuenta de D&D Beyond",
    status: "dormant",
    dormantReason:
      "D&D Beyond no publica una API de escritura. El cruce espera una via que no rompa sus terminos.",
  },
  {
    id: "roll20",
    name: "Roll20",
    yields: "Personaje en tu campana de Roll20",
    status: "dormant",
    dormantReason:
      "Roll20 importa por su propio formato de hoja. El mapeo desde el payload todavia no esta escrito.",
  },
];

export function realmById(id: RealmId | null): Realm | null {
  return REALMS.find((realm) => realm.id === id) ?? null;
}

/* ---------------- JSON ---------------- */

/**
 * The payload, downloaded.
 *
 * The same bytes the Worker stores under a code — so a player who cannot
 * reach the network, or does not want to, still has the thing itself.
 */
export function downloadPayloadJson(payload: ImportPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, payloadFileName(payload));
}

/* ---------------- PDF ---------------- */

/**
 * A printable sheet, through the browser's own print dialog.
 *
 * No PDF library: the browser already has a typesetter and a PDF writer, and
 * shipping a second one would cost more than this page is worth.
 */
export function printCharacterSheet(build: CharacterBuild) {
  const sheet = window.open("", "_blank", "width=880,height=1100");
  if (!sheet) return false;

  sheet.document.write(characterSheetHtml(build));
  sheet.document.close();
  setTimeout(() => sheet.print(), 400);
  return true;
}

/**
 * The sheet itself, as a string.
 *
 * Split out from `printCharacterSheet` so it can be checked without a browser:
 * everything that has gone wrong on this sheet — an English prefix printed
 * into a Spanish document, a section silently missing — is visible in the
 * markup and invisible from the outside. `window` never appears here.
 */
export function characterSheetHtml(build: CharacterBuild): string {
  const abilityRows = (["str", "dex", "con", "int", "wis", "cha"] as const)
    .map((ability) => {
      const score = build.abilities.final[ability];
      const modifier = Math.floor((score - 10) / 2);
      return `<tr><td>${abilityLabels[ability] ?? ability.toUpperCase()}</td><td class="num">${score}</td><td class="num">${modifier >= 0 ? "+" : ""}${modifier}</td></tr>`;
    })
    .join("");

  const classLine = build.classing.classes
    .map((entry) => `${titleCase(entry.classId)}${entry.subclassId ? ` (${titleCase(entry.subclassId)})` : ""} ${entry.level}`)
    .join(" / ");

  /*
   * Proficiencies, split by what they actually are.
   *
   * `choices.proficiencies` is the flat list, and it stores languages with an
   * English `"Language: "` prefix — which printed straight onto a Spanish
   * sheet as "Language: Dwarvish", filed under Competencias. The normalized
   * list carries a `kind` per entry, so each goes under its own heading and
   * saving throws stop being left off the sheet entirely.
   */
  const normalized = build.choices.normalized?.proficiencies;

  const byKind = (kind: string) =>
    (normalized ?? [])
      .filter((entry) => entry.kind === kind)
      .map((entry) => `<li>${escapeHtml(entry.label)}</li>`)
      .join("");

  const languagePrefix = /^Language:\s*/i;
  const flat = (keep: "languages" | "rest") =>
    build.choices.proficiencies
      .filter((entry) => languagePrefix.test(entry) === (keep === "languages"))
      .map((entry) => `<li>${escapeHtml(entry.replace(languagePrefix, ""))}</li>`)
      .join("");

  // A build from elsewhere may carry only the flat list. Splitting the
  // prefixed language lines out of it is the least this sheet can do — the
  // alternative is printing "Language: Dwarvish" under Competencias.
  const skills = normalized ? byKind("skill") : "";
  const tools = normalized ? byKind("tool") : "";
  const languages = normalized ? byKind("language") : flat("languages");
  const savingThrows = byKind("savingThrow");
  const otherProficiencies = normalized
    ? ["weapon", "armor", "other"].map(byKind).join("")
    : // Unsorted, because without the kinds there is nothing to sort by.
      flat("rest");

  const biography = (
    [
      ["Rasgo", build.identity.biography?.trait],
      ["Ideal", build.identity.biography?.ideal],
      ["Vinculo", build.identity.biography?.bond],
      ["Defecto", build.identity.biography?.flaw],
    ] as const
  )
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<tr><td>${label}</td><td>${escapeHtml(value as string)}</td></tr>`)
    .join("");

  const spells = build.choices.spells.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  const equipment = build.choices.equipment.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  const features = build.choices.features.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>${escapeHtml(build.identity.characterName)} — Faro del Alba</title>
<style>
  @page { margin: 18mm; }
  body { background:#f4ecd8; color:#1a140e; font-family: Georgia, 'Times New Roman', serif;
         max-width: 760px; margin: 0 auto; padding: 40px 32px; }
  h1 { font-variant: small-caps; letter-spacing:.12em; margin:0 0 4px;
       border-bottom: 3px double #6E0F0F; padding-bottom: 10px; font-size: 30px; }
  .meta { color:#5a4a30; font-style: italic; margin: 8px 0 28px; }
  .grid { display:flex; gap:28px; align-items:flex-start; }
  .grid > * { flex:1; }
  h2 { font-variant: small-caps; letter-spacing:.1em; font-size:15px; color:#6E0F0F;
       border-bottom:1px solid #b8a888; padding-bottom:4px; margin:22px 0 10px; }
  table { width:100%; border-collapse:collapse; }
  td { border-bottom:1px solid #ccbfa4; padding:7px 10px; }
  td:first-child { font-weight:bold; }
  .num { text-align:right; font-variant-numeric: tabular-nums; width:56px; }
  .stats { display:flex; gap:18px; margin: 4px 0 12px; }
  .stat { border:1px solid #b8a888; padding:8px 14px; text-align:center; min-width:78px; }
  .stat span { display:block; font-size:11px; letter-spacing:.14em;
               text-transform:uppercase; color:#6b5a3e; }
  .stat b { font-size:22px; }
  ul { margin:0; padding-left:18px; }
  li { margin:3px 0; }
  footer { margin-top:34px; border-top:1px solid #b8a888; padding-top:10px;
           font-size:11px; color:#6b5a3e; letter-spacing:.08em; }
</style></head><body>
<h1>${escapeHtml(build.identity.characterName)}</h1>
<p class="meta">${escapeHtml(classLine)} · ${titleCase(build.ancestry.subraceId || build.ancestry.raceId)} · ${titleCase(build.background.backgroundId)}${build.identity.alignment ? ` · ${escapeHtml(build.identity.alignment)}` : ""}</p>

<div class="stats">
  <div class="stat"><span>Puntos de golpe</span><b>${build.derived.hp}</b></div>
  <div class="stat"><span>Clase de armadura</span><b>${build.derived.ac}</b></div>
  <div class="stat"><span>Competencia</span><b>+${build.derived.proficiencyBonus}</b></div>
  ${build.derived.spellcasting ? `<div class="stat"><span>CD de salvacion</span><b>${build.derived.spellcasting.saveDC}</b></div>` : ""}
</div>

<div class="grid">
  <div>
    <h2>Aptitudes</h2>
    <table>${abilityRows}</table>
    ${savingThrows ? `<h2>Salvaciones</h2><ul>${savingThrows}</ul>` : ""}
    ${skills ? `<h2>Habilidades</h2><ul>${skills}</ul>` : ""}
    ${tools ? `<h2>Herramientas</h2><ul>${tools}</ul>` : ""}
    ${languages ? `<h2>Idiomas</h2><ul>${languages}</ul>` : ""}
    ${otherProficiencies ? `<h2>${skills ? "Otras competencias" : "Competencias"}</h2><ul>${otherProficiencies}</ul>` : ""}
  </div>
  <div>
    ${features ? `<h2>Rasgos</h2><ul>${features}</ul>` : ""}
    ${equipment ? `<h2>Equipo</h2><ul>${equipment}</ul>` : ""}
    ${spells ? `<h2>Conjuros</h2><ul>${spells}</ul>` : ""}
  </div>
</div>

${biography ? `<h2>Historia</h2><table>${biography}</table>` : ""}
${build.identity.biography?.notes ? `<h2>Notas</h2><p>${escapeHtml(build.identity.biography.notes)}</p>` : ""}

<footer>Sellado en el Faro del Alba · ${new Date(build.meta.updatedAt).toLocaleDateString()} · ${build.meta.rulesVersion}</footer>
</body></html>`;
}

/* ---------------- helpers ---------------- */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  // Firefox ignores a programmatic click on an anchor that is not in the
  // document, and revoking the URL in the same tick can cancel a download that
  // has not started reading yet. Both failures are silent — the player clicks
  // and simply gets no file.
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * The name of the file a player gets.
 *
 * This used to keep only `[A-Za-z0-9_.-]`, which in a Spanish app means the
 * accents are deleted: "José Fernández" downloaded as `Jos_Fernndez`. Worse,
 * a name in any non-Latin script kept nothing at all and every such character
 * downloaded as `personaje.vault.json` — the same filename for all of them.
 *
 * Accents and other scripts are kept: every current filesystem takes them.
 * What is removed is only what a filesystem actually refuses — the Windows
 * reserved set, path separators and control characters — plus the leading and
 * trailing dots and spaces Windows silently drops.
 */
export function fileSlug(name: string) {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[.\s_]+|[.\s_]+$/g, "")
    // Long enough for any real name, short enough to stay under the path
    // limits once the extension and a download folder are added.
    .slice(0, 80);

  return cleaned || "personaje";
}

/** What the JSON download is called. */
export function payloadFileName(payload: ImportPayload): string {
  return `${fileSlug(payload.identity.characterName)}.vault.json`;
}

function titleCase(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
