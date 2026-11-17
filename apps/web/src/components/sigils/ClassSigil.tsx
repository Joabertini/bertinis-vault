import { useId } from "react";

import { CLASS_SIGILS, type ClassSigilArt } from "@/lib/class-sigils";

/** Below this size the rings read as noise; the glyph alone carries the class. */
const RINGS_FROM = 48;

/** Whether a class has a sigil of the canon. */
export function hasClassSigil(classId: string): boolean {
  return classId.trim().toLowerCase() in CLASS_SIGILS;
}

/**
 * A class's sigil, the canon for all of D&D (approved 2026-11-17): the class's
 * shape drawn as a luminous hand-made stroke in the class's colour, the same
 * emblem the «Misión cumplida» cards wear. Two irregular rings frame it when
 * there is room for them.
 *
 * The strokes are fixed at build time (tools/class-sigils), so the page does
 * not load Rough.js and a class looks the same on every visit.
 */
export default function ClassSigil({
  classId,
  size = 48,
  rings,
  className = "",
  label,
}: {
  classId: string;
  size?: number;
  /** Draw the rings. By default, only from 48px up. */
  rings?: boolean;
  className?: string;
  /** Spoken name; omit when the name is written beside it. */
  label?: string;
}) {
  const art = CLASS_SIGILS[classId.trim().toLowerCase()];
  if (!art) return null;
  return <SigilArt art={art} size={size} className={className} {...(rings === undefined ? {} : { rings })} {...(label ? { label } : {})} />;
}

/** Draws a sigil of the canon from its art; `ClassSigil` looks the art up by class. */
export function SigilArt({
  art,
  size = 48,
  rings,
  className = "",
  label,
}: {
  art: ClassSigilArt;
  size?: number;
  rings?: boolean;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");

  const withRings = rings ?? size >= RINGS_FROM;
  // With rings the drawing sits inside a circle of radius ~340; without, the glyph fills the box.
  const view = withRings ? "-100 -100 712 712" : "0 0 512 512";
  // The halo scales with the drawing, so it stays a glow at 22px and at 200px.
  const blur = withRings ? 1 : 0.8;
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  const strokes = (
    <>
      <path d={art.glyph} fill="none" stroke={art.color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d={art.glyph} fill="none" stroke={art.core} strokeWidth="3.85" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );

  return (
    <svg {...a11y} viewBox={view} width={size} height={size} className={className} style={{ overflow: "visible", flex: "none" }}>
      <defs>
        <filter id={`glow${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={5.6 * blur} result="a" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={19.6 * blur} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="a" />
            <feMergeNode in="a" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {art.fillCircle && (
          <clipPath id={`clip${uid}`}>
            <circle cx="256" cy="256" r="296" />
          </clipPath>
        )}
      </defs>
      {withRings && (
        <path d={art.rings} fill="none" stroke={art.color} strokeWidth="3" opacity="0.55" filter={`url(#glow${uid})`} />
      )}
      <g filter={`url(#glow${uid})`}>
        {art.fillCircle ? (
          <g clipPath={`url(#clip${uid})`}>
            <g transform={`translate(256 256) scale(${art.fillCircle}) translate(-256 -256)`}>{strokes}</g>
          </g>
        ) : (
          strokes
        )}
      </g>
    </svg>
  );
}
