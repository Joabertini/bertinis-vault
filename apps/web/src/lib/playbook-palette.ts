/**
 * Los colores con los que la cheatsheet tiñe cada clase.
 *
 * Salen tal cual de `Joabertini/dnd-cheatsheet`, que es el diseño que este
 * repositorio adopta: ahí cada clase trae tres valores y no uno.
 *
 * - `color` es el trazo: bordes, la línea bajo la pestaña abierta, el fondo de
 *   las cabeceras de sección.
 * - `accent` es el mismo tono más claro, y es el único que toca el texto —
 *   sobre negro, `color` no llega a leerse.
 * - `bg` es el tinte de la página, casi negro, con la clase apenas insinuada.
 *
 * Los tres se usan siempre con una opacidad en hexadecimal (`${color}30`), que
 * es como la hoja original arma cada capa.
 */
export type ClassPalette = {
  color: string;
  accent: string;
  bg: string;
};

/** El gris del Vault, para una clase que la cheatsheet no pinta. */
export const NEUTRAL_PALETTE: ClassPalette = {
  color: "#555555",
  accent: "#8a857c",
  bg: "#0d0d0d",
};

const PALETTES: Record<string, ClassPalette> = {
  fighter: { color: "#c0392b", accent: "#e74c3c", bg: "#1a0a0a" },
  barbarian: { color: "#e67e22", accent: "#f39c12", bg: "#1a1000" },
  rogue: { color: "#27ae60", accent: "#2ecc71", bg: "#001a08" },
  wizard: { color: "#8e44ad", accent: "#9b59b6", bg: "#0d0018" },
  cleric: { color: "#f1c40f", accent: "#f39c12", bg: "#1a1500" },
  paladin: { color: "#d4af37", accent: "#ffd700", bg: "#1a1500" },
  ranger: { color: "#16a085", accent: "#1abc9c", bg: "#001510" },
  warlock: { color: "#6c3483", accent: "#8e44ad", bg: "#0d0018" },
  bard: { color: "#2980b9", accent: "#3498db", bg: "#000d1a" },
  druid: { color: "#27ae60", accent: "#2ecc71", bg: "#001a05" },
  monk: { color: "#e67e22", accent: "#f39c12", bg: "#1a0a00" },
  sorcerer: { color: "#c0392b", accent: "#e74c3c", bg: "#1a0505" },
};

export function paletteFor(classId: string): ClassPalette {
  return PALETTES[classId] ?? NEUTRAL_PALETTE;
}
