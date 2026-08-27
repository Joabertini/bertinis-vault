/**
 * The engraved mark for a species or a class.
 *
 * Keyed by the same slug a build stores, so `sigilFor("half-orc")` and the id
 * in the payload are the same string — a sigil cannot drift from the thing it
 * marks.
 *
 * Everything is drawn on a 64x64 field in one stroke weight family, with no
 * fills except deliberate accents, so a glyph reads at 22px on a divider and
 * at 56px on an open tome without a second asset.
 */

const CLASS_PATHS: Record<string, React.ReactNode> = {
  fighter: (
    <>
      <path d="M32 6v44M22 16l10-10 10 10" strokeWidth="2.5" />
      <path d="M18 50h28M14 56h36" strokeWidth="1.5" />
    </>
  ),
  wizard: (
    <>
      <circle cx="32" cy="26" r="12" strokeWidth="2" />
      <path d="M32 38v18M24 50h16M26 14l6-8 6 8" strokeWidth="2" />
      <path d="M14 26h6M44 26h6" strokeWidth="1.5" />
    </>
  ),
  warlock: (
    <>
      <path d="M32 10c10 8 14 18 14 26 0 8-6 14-14 14s-14-6-14-14c0-8 4-18 14-26z" strokeWidth="2.5" />
      <circle cx="32" cy="34" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  barbarian: (
    <>
      <path d="M14 20l18-8 18 8-6 26-12 10-12-10z" strokeWidth="2.5" />
      <path d="M20 34h24M32 42v8" strokeWidth="2" />
    </>
  ),
  rogue: (
    <>
      <path d="M32 8l8 14-8 30-8-30z" strokeWidth="2" />
      <path d="M32 52v6M22 30h20" strokeWidth="1.5" />
    </>
  ),
  paladin: (
    <>
      <path d="M32 8l18 6v16c0 12-8 20-18 24-10-4-18-12-18-24V14z" strokeWidth="2.5" />
      <path d="M32 16v22M24 26h16" strokeWidth="2" />
    </>
  ),
  bard: (
    <>
      {/* lyre — two arms, a crossbar, and strings */}
      <path d="M22 48c-6-12-5-26 2-34M42 48c6-12 5-26-2-34" strokeWidth="2.5" />
      <path d="M24 14h16" strokeWidth="2" />
      <path d="M28 16v28M32 15v30M36 16v28" strokeWidth="1" />
      <path d="M19 48h26" strokeWidth="2.5" />
    </>
  ),
  cleric: (
    <>
      {/* radiant symbol above a standing stem */}
      <circle cx="32" cy="24" r="9" strokeWidth="2" />
      <path
        d="M32 5v5M32 38v4M11 24h5M48 24h5M17 9l3.5 3.5M47 9l-3.5 3.5M17 39l3.5-3.5M47 39l-3.5-3.5"
        strokeWidth="1.5"
      />
      <path d="M32 42v14M25 56h14" strokeWidth="2.5" />
    </>
  ),
  druid: (
    <>
      {/* a single leaf, veined */}
      <path d="M32 55C18 45 13 28 22 13c15 2 25 15 23 29-1 8-6 13-13 13z" strokeWidth="2.5" />
      <path d="M22 13c9 11 10 26 10 42" strokeWidth="1.5" />
      <path d="M27 27l-4-2M31 37l-6-3M35 45l-6-3" strokeWidth="1" />
    </>
  ),
  monk: (
    <>
      {/* closed fist, with the ki that moves it */}
      <path d="M20 31a4 4 0 018 0M28 27a4 4 0 018 0M36 29a4 4 0 018 0" strokeWidth="2" />
      <path d="M20 31v9c0 7 5 12 12 12s12-5 12-12V29" strokeWidth="2.5" />
      <path d="M12 20l4 3M52 20l-4 3M32 10v5" strokeWidth="1.5" />
    </>
  ),
  ranger: (
    <>
      {/* bow drawn, arrow nocked */}
      <path d="M22 10c12 8 12 36 0 44" strokeWidth="2.5" />
      <path d="M22 10v44" strokeWidth="1" />
      <path d="M14 32h32" strokeWidth="2" />
      <path d="M40 26l6 6-6 6M17 28l-3 4 3 4" strokeWidth="2" />
    </>
  ),
  sorcerer: (
    <>
      {/* flame from the blood, not from a book */}
      <path d="M32 55c-8 0-15-6-15-14 0-11 9-15 11-27 7 7 19 13 19 27 0 8-7 14-15 14z" strokeWidth="2.5" />
      <path d="M32 47c-4 0-6-3-6-6 0-5 4-7 5-12 3 4 7 7 7 12 0 3-2 6-6 6z" strokeWidth="1.5" />
    </>
  ),
  artificer: (
    <>
      {/* gear and its axle */}
      <circle cx="32" cy="32" r="12" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="4" strokeWidth="2" />
      <path
        d="M32 14v6M32 44v6M14 32h6M44 32h6M19 19l4 4M45 19l-4 4M19 45l4-4M45 45l-4-4"
        strokeWidth="2"
      />
    </>
  ),
};

const RACE_PATHS: Record<string, React.ReactNode> = {
  human: (
    <>
      {/* upright, arms open — the versatile silhouette */}
      <circle cx="32" cy="15" r="6" strokeWidth="2" />
      <path d="M32 21v21M17 29h30M23 57l9-15 9 15" strokeWidth="2.5" />
    </>
  ),
  elf: (
    <>
      {/* crescent and star */}
      <path d="M41 11a21 21 0 100 42 17 17 0 010-42z" strokeWidth="2.5" />
      <path d="M47 19l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" strokeWidth="1.5" />
    </>
  ),
  dwarf: (
    <>
      {/* anvil */}
      <path d="M12 25h40c0 7-7 9-11 11v12h6v6H17v-6h6V36c-7-2-11-4-11-11z" strokeWidth="2.5" />
    </>
  ),
  halfling: (
    <>
      {/* acorn */}
      <path d="M17 26c0-8 7-15 15-15s15 7 15 15z" strokeWidth="2.5" />
      <path d="M20 26c0 13 5 25 12 27 7-2 12-14 12-27" strokeWidth="2.5" />
      <path d="M32 11V5" strokeWidth="2" />
    </>
  ),
  gnome: (
    <>
      {/* pointed hat over a gear */}
      <path d="M32 7L17 37h30z" strokeWidth="2.5" />
      <path d="M13 37h38" strokeWidth="2" />
      <circle cx="32" cy="49" r="7" strokeWidth="2" />
      <path d="M32 40v3M32 55v3M25 49h-3M42 49h3" strokeWidth="1.5" />
    </>
  ),
  dragonborn: (
    <>
      {/* horned snout in profile */}
      <path d="M9 39c4-11 15-17 27-17 10 0 16 6 16 13 0 8-8 13-18 13H15z" strokeWidth="2.5" />
      <path d="M40 22l11-11-2 13" strokeWidth="2" />
      <path d="M16 40h16" strokeWidth="1.5" />
      <circle cx="37" cy="32" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  tiefling: (
    <>
      {/* two horns above a brow */}
      <path d="M22 43C14 37 11 26 13 15c6 3 11 10 13 17" strokeWidth="2.5" />
      <path d="M42 43c8-6 11-17 9-28-6 3-11 10-13 17" strokeWidth="2.5" />
      <path d="M25 45c2-5 4-7 7-7s5 2 7 7" strokeWidth="2" />
      <path d="M32 50v7" strokeWidth="1.5" />
    </>
  ),
  "half-elf": (
    <>
      {/* one heritage each side of the line */}
      <path d="M32 6v52" strokeWidth="1" opacity="0.5" />
      <path d="M27 15a18 18 0 000 34 14 14 0 010-34z" strokeWidth="2.5" />
      <circle cx="43" cy="19" r="4.5" strokeWidth="2" />
      <path d="M43 24v13M36 29h14M38 49l5-12 5 12" strokeWidth="2" />
    </>
  ),
  "half-orc": (
    <>
      {/* jaw and tusks, restrained */}
      <path d="M16 21h32" strokeWidth="2" />
      <path d="M18 23c0 15 6 26 14 26s14-11 14-26" strokeWidth="2.5" />
      <path d="M24 30c-3 7-2 12 0 15M40 30c3 7 2 12 0 15" strokeWidth="2" />
    </>
  ),
  orc: (
    <>
      {/* the same jaw, unrestrained */}
      <path d="M13 19h38" strokeWidth="2.5" />
      <path d="M17 21c0 17 6 29 15 29s15-12 15-29" strokeWidth="2.5" />
      <path d="M22 27c-5 9-4 16 0 20M42 27c5 9 4 16 0 20" strokeWidth="2.5" />
      <path d="M26 33h4M34 33h4" strokeWidth="1.5" />
    </>
  ),
  goliath: (
    <>
      {/* born of the mountain */}
      <path d="M6 51l16-27 8 13 9-20 19 34z" strokeWidth="2.5" />
      <path d="M22 24l-6 11M39 17l6 11" strokeWidth="1.5" />
      <path d="M6 51h52" strokeWidth="2" />
    </>
  ),
  aasimar: (
    <>
      {/* halo above wings */}
      <ellipse cx="32" cy="13" rx="12" ry="4.5" strokeWidth="2" />
      <path d="M32 23c-8-4-19-2-25 7 9 2 15 6 19 13M32 23c8-4 19-2 25 7-9 2-15 6-19 13" strokeWidth="2.5" />
      <path d="M32 23v28" strokeWidth="1.5" />
    </>
  ),
};

/** The hexagonal ward, for anything from a book we have no glyph for. */
const DEFAULT = (
  <path d="M32 10l16 10v20L32 54 16 40V20z M32 22l8 5v10l-8 5-8-5V27z" strokeWidth="2.5" />
);

/** Whether a glyph was drawn for this id, or it falls back to the ward. */
export function hasSigil(name: string): boolean {
  return name in CLASS_PATHS || name in RACE_PATHS;
}

export default function Sigil({
  name,
  size = 48,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const art = CLASS_PATHS[name] ?? RACE_PATHS[name] ?? DEFAULT;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-all duration-500 ${className}`}
      aria-hidden
    >
      {art}
    </svg>
  );
}
