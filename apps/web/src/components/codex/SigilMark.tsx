import type { RoleSigil } from "@/lib/role-sigil";

/**
 * A role sigil as the cover shows it: the glyph in its role colour, lit from
 * within, on a dark medallion so it reads over any picture.
 *
 * This is the SVG twin of what `CodexShelf` paints on the 3D cover; the two
 * share `ROLE_SIGILS`, so the preview in the Forge and the book on the shelf
 * cannot disagree.
 */
export default function SigilMark({ sigil, size = 96 }: { sigil: RoleSigil; size?: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={`Sigilo de ${sigil.name}`}
      style={{ filter: `drop-shadow(0 0 10px ${sigil.color}88)` }}
    >
      <circle cx="256" cy="256" r="244" fill="#000000" fillOpacity="0.72" stroke={sigil.color} strokeWidth="10" />
      <circle cx="256" cy="256" r="222" fill="none" stroke={sigil.color} strokeOpacity="0.4" strokeWidth="3" />
      <g transform="translate(96 96) scale(0.625)" fill={sigil.color} stroke={sigil.core} strokeWidth="6" strokeOpacity="0.55">
        {sigil.paths.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </g>
    </svg>
  );
}
