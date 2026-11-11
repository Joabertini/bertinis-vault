import type { RoleSigil } from "@/lib/role-sigil";

/**
 * A class sigil as the cover shows it: the glyph in its role colour, lit from
 * within, over a soft dark pool so it reads on any picture. There is no frame:
 * the pool fades out instead of ending in a ring. A round drawing grows to fill
 * the circle; the rest keep their own size.
 *
 * This is the SVG twin of what `CodexShelf` paints on the 3D cover; both read
 * `sigilFor`, so the preview in the Forge and the book on the shelf cannot
 * disagree.
 */
export default function SigilMark({ sigil, size = 96 }: { sigil: RoleSigil; size?: number }) {
  const scale = sigil.fills ? 1 : 0.8;
  const offset = 256 - 256 * scale;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={`Sigilo de ${sigil.name}`}
      style={{ filter: `drop-shadow(0 0 10px ${sigil.color}88)` }}
    >
      <defs>
        <radialGradient id="sigil-pool">
          <stop offset="0" stopColor="#000" stopOpacity="0.78" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="256" cy="256" r="256" fill="url(#sigil-pool)" />
      <g
        transform={`translate(${offset} ${offset}) scale(${scale})`}
        fill={sigil.color}
        stroke={sigil.core}
        strokeWidth="6"
        strokeOpacity="0.55"
      >
        {sigil.paths.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </g>
    </svg>
  );
}
