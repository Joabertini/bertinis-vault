/**
 * The sigil on a character's cover: one of the five role symbols of the
 * Westmarch "Misión cumplida" role picker, with the same colours.
 *
 * The colours and icons are the picker's (foundry-westmarch,
 * `partida/roles.js`), unchanged, so the cover and the popup read as the same
 * family. What is new here is the class → role table: the picker's one maps
 * Pathfinder classes, and this builder is D&D 5e.
 */

import { ROLE_ICON_PATHS } from "@/lib/role-icon-paths";

export type SigilRole = "dano" | "defensa" | "sanacion" | "apoyo" | "control";

export type RoleSigil = {
  id: SigilRole;
  name: string;
  /** The role's colour: the glyph, its ring and the glow. */
  color: string;
  /** The hot centre of the glow. */
  core: string;
  /** game-icons.net path data, viewBox 512x512. */
  paths: string[];
};

export const ROLE_SIGILS: Record<SigilRole, RoleSigil> = {
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

export function sigilRoleFor(classId: string): SigilRole {
  return BY_CLASS[classId.trim().toLowerCase()] ?? "dano";
}

export function sigilFor(classId: string): RoleSigil {
  return ROLE_SIGILS[sigilRoleFor(classId)];
}
