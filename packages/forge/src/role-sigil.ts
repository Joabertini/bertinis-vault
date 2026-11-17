/**
 * The sigil on a character's cover: the glyph of the character's class, in the
 * colour of its role.
 *
 * The colours come from the five roles of the Westmarch "Misión cumplida" role
 * picker (foundry-westmarch, `partida/roles.js`), unchanged, so the cover and
 * the popup read as the same family. The glyph is the class's own (D&D has far
 * fewer classes than Pathfinder, so each gets a drawing of its own); the
 * picker's five role icons remain as the glyph of a class this table does not
 * know, such as an imported homebrew one.
 */

import { CLASS_ICON_PATHS } from "./class-icon-paths";
import { ROLE_ICON_PATHS } from "./role-icon-paths";
import { CLASS_SIGILS, type ClassSigilArt } from "./class-sigils";

export type SigilRole = "dano" | "defensa" | "sanacion" | "apoyo" | "control";

type Role = {
  id: SigilRole;
  name: string;
  /** The role's colour: the glyph and its glow. */
  color: string;
  /** The hot edge of the glow. */
  core: string;
  /** The role's own icon, used when a class has none. */
  paths: string[];
};

export type RoleSigil = Role & {
  /**
   * Whether the glyph grows to fill the whole circle.
   *
   * Only for drawings that are round or radiate from a centre, where leaving
   * space around them looks small. A sword or a lyre stays its own size: grown
   * to the circle it would just be a bigger sword in a box.
   */
  fills: boolean;
  /** The class's sigil of the canon, when it has one: draw this, in its colour, instead of the filled glyph. */
  art?: ClassSigilArt;
};

export const ROLES: Record<SigilRole, Role> = {
  dano: { id: "dano", name: "Daño", color: "#ff5a1f", core: "#ffe1c2", paths: ROLE_ICON_PATHS["crossed-swords"]! },
  defensa: { id: "defensa", name: "Defensa", color: "#c9d6e6", core: "#ffffff", paths: ROLE_ICON_PATHS["checked-shield"]! },
  sanacion: { id: "sanacion", name: "Sanación", color: "#f2b437", core: "#fff1c9", paths: ROLE_ICON_PATHS["winged-shield"]! },
  apoyo: { id: "apoyo", name: "Apoyo", color: "#7fc4ff", core: "#e3f3ff", paths: ROLE_ICON_PATHS["rally-the-troops"]! },
  control: { id: "control", name: "Control", color: "#a76bff", core: "#eadcff", paths: ROLE_ICON_PATHS["vortex"]! },
};

/**
 * The default role of each D&D 5e class. It is a starting point, not a rule:
 * a paladin who heals is a paladin whose player can say so.
 */
const BY_CLASS: Record<string, SigilRole> = {
  fighter: "dano",
  barbarian: "dano",
  rogue: "dano",
  monk: "dano",
  ranger: "dano",
  paladin: "defensa",
  cleric: "sanacion",
  bard: "apoyo",
  artificer: "apoyo",
  wizard: "control",
  sorcerer: "control",
  warlock: "control",
  druid: "control",
};

/** Classes whose drawing is round or radiates from its centre. */
const FILLS = new Set(["sorcerer", "warlock"]);

export function sigilRoleFor(classId: string): SigilRole {
  return BY_CLASS[classId.trim().toLowerCase()] ?? "dano";
}

export function sigilFor(classId: string): RoleSigil {
  const key = classId.trim().toLowerCase();
  const role = ROLES[sigilRoleFor(key)];
  const own = CLASS_ICON_PATHS[key];
  const art = CLASS_SIGILS[key];
  // The colour belongs to the class, not to its role (owner's canon, 2026-11-17).
  if (own && art) return { ...role, color: art.color, core: art.core, paths: own.paths, fills: FILLS.has(key), art };
  return own ? { ...role, paths: own.paths, fills: FILLS.has(key) } : { ...role, fills: false };
}
