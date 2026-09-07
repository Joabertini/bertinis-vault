/**
 * Volcar los ids que el catálogo resuelve de verdad.
 *
 * Escribir un personaje a mano quiere ids exactos —`school-of-evocation`, no
 * "Evocación"— y adivinarlos produce un `subclassId` que no resuelve y una
 * ficha que se publica igual con la subclase vacía. Esto los imprime.
 *
 * Desde `apps/web`:
 *
 *   corepack pnpm exec vite build --ssr probes/ids.ts --outDir .probe
 *   node .probe/ids.js
 */
import { allOptions, coreOptions, subclassesFor, subracesFor } from "@/lib/catalog";
import { optionsFor } from "@/lib/index-options";

const RULES = "2014" as const;

function line(label: string, entries: { id: string; label: string }[]): void {
  console.log(`\n## ${label} (${entries.length})`);
  for (const entry of entries) console.log(`${entry.id}\t${entry.label}`);
}

const classes = coreOptions("class", RULES);
line("clases", classes);

for (const cls of classes) {
  line(`subclases de ${cls.id}`, subclassesFor(cls.label, RULES, "", 200));
}

const species = coreOptions("race", RULES);
line("especies del libro basico", species);

for (const race of species) {
  const subraces = subracesFor(race.label, RULES, "", 40);
  if (subraces.length > 0) line(`sublinajes de ${race.id}`, subraces);
}

line("trasfondos del libro basico", allOptions("background", RULES).slice(0, 20));

line("dotes", optionsFor({ prop: "feat", rulesVersion: RULES, search: "", limit: 200 }));

line(
  "armas",
  optionsFor({ prop: "item", rulesVersion: RULES, search: "", weaponsOnly: true, limit: 120 }),
);

line(
  "armaduras y escudos",
  optionsFor({ prop: "item", rulesVersion: RULES, search: "", armorOnly: true, limit: 60 }),
);
