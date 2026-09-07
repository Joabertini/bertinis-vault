/**
 * Buscar un id exacto por nombre, para no escribirlo de memoria.
 *
 * `armorId: "studded-leather"` se publica igual que `"studded-leather-armor"`;
 * la diferencia es que uno resuelve y el otro deja la ficha sin armadura y sin
 * decirlo. Esto imprime lo que el índice tiene de verdad.
 *
 *   corepack pnpm exec vite build --ssr probes/buscar-ids.ts --outDir .probe
 *   node .probe/buscar-ids.js
 */
import { optionsFor } from "@/lib/index-options";

const RULES = "2014" as const;

const ARMAS = [
  "Greataxe", "Maul", "Rapier", "Shortsword", "Mace", "Warhammer", "Quarterstaff",
  "Sickle", "Halberd", "Longsword", "Greatsword", "Longbow", "Hand Crossbow",
  "Dagger", "Light Crossbow", "Scimitar", "Spear", "Battleaxe",
];

const ARMADURAS = [
  "Hide Armor", "Chain Mail", "Leather Armor", "Studded Leather", "Splint",
  "Plate", "Scale Mail", "Half Plate", "Shield", "Breastplate",
];

const OTROS = [
  "Explorer's Pack", "Dungeoneer's Pack", "Component Pouch", "Spellbook",
  "Holy Symbol", "Thieves' Tools", "Arcane Focus", "Druidic Focus",
  "Healer's Kit", "Rope", "Torch", "Rations",
];

function buscar(titulo: string, nombres: string[], opciones: object): void {
  console.log(`\n## ${titulo}`);
  for (const nombre of nombres) {
    const hits = optionsFor({ prop: "item", rulesVersion: RULES, search: nombre, limit: 30, ...opciones });
    const exacto = hits.find((hit) => hit.label.toLowerCase() === nombre.toLowerCase());
    console.log(
      `${nombre.padEnd(20)} ${exacto ? `EXACTO ${exacto.id}` : `~ ${hits.map((h) => h.id).join(", ") || "(nada)"}`}`,
    );
  }
}

buscar("armas", ARMAS, { weaponsOnly: true });
buscar("armaduras", ARMADURAS, { armorOnly: true });
buscar("equipo", OTROS, {});
