/**
 * The printed sheet's furniture: paper, boxes, bubbles, rules.
 *
 * These are the shapes the official sheets are made of, and the two layouts
 * are nothing but arrangements of them. Kept apart from either sheet so the
 * 2014 and the 2024 pages cannot drift into two slightly different papers.
 *
 * It is a sheet of paper and it is drawn as one — ink on parchment, inside the
 * window rather than instead of it. The app is dark and this is not: a sheet
 * that is not the sheet is the thing this was asked to stop being.
 */

export const PAPER = "#f2ece0";
export const INK = "#1a1714";
export const RULE = "#1a171433";

export function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: PAPER, color: INK, fontFamily: "Georgia, 'Times New Roman', serif" }}
      className="px-5 py-6 md:px-8"
    >
      {children}
    </div>
  );
}

/** A caption in the sheet's own voice: small, spaced, under what it names. */
export function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-center text-[8px] uppercase tracking-[0.12em] opacity-70 ${className}`}>
      {children}
    </p>
  );
}

/** A bordered box with its label underneath, the sheet's basic unit. */
export function Box({
  label,
  children,
  className = "",
  dashed,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  /** The official sheet dashes the boxes that hold prose. */
  dashed?: boolean;
}) {
  return (
    <div className={className}>
      <div
        style={{ borderColor: INK, borderStyle: dashed ? "dashed" : "solid" }}
        className="border px-2 py-1.5"
      >
        {children}
      </div>
      {label && <Caption className="mt-0.5">{label}</Caption>}
    </div>
  );
}

/** A big number in a box: armour class, initiative, speed. */
export function Vital({ label, value }: { label: string; value: string }) {
  return (
    <Box label={label}>
      <p className="py-1 text-center text-xl font-bold leading-none">{value}</p>
    </Box>
  );
}

/**
 * The ability block: the modifier large, the score in the oval below it.
 *
 * That order is the sheet's and it is the right one — the modifier is what a
 * player uses twenty times an evening and the score is what they look at when
 * something asks for it.
 */
export function AbilityBox({
  label,
  modifier,
  score,
}: {
  label: string;
  modifier: string;
  score: number;
}) {
  return (
    <div style={{ borderColor: INK }} className="relative border px-2 pb-4 pt-1.5 text-center">
      <p className="text-[8px] uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none">{modifier}</p>
      <span
        style={{ borderColor: INK, background: PAPER }}
        className="absolute -bottom-3 left-1/2 min-w-[34px] -translate-x-1/2 rounded-full border px-2 py-0.5 text-xs font-bold"
      >
        {score}
      </span>
    </div>
  );
}

/** Trained, doubled, or neither — the circle beside every check. */
export function ProfDot({
  proficient,
  expert,
}: {
  proficient: boolean;
  /** `| undefined` on purpose: `exactOptionalPropertyTypes` is on. */
  expert?: boolean | undefined;
}) {
  return (
    <span
      title={expert ? "Maestria" : proficient ? "Competente" : "Sin competencia"}
      style={{ borderColor: INK, background: proficient ? INK : "transparent" }}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border ${expert ? "ring-1 ring-offset-1" : ""}`}
    />
  );
}

/** One check: circle, modifier, name. */
export function CheckRow({
  proficient,
  expert,
  modifier,
  name,
  suffix,
}: {
  proficient: boolean;
  expert?: boolean | undefined;
  modifier: string;
  name: string;
  suffix?: string | undefined;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-snug">
      <ProfDot proficient={proficient} expert={expert} />
      <span className="w-6 shrink-0 text-right font-bold">{modifier}</span>
      <span className="truncate">{name}</span>
      {suffix && <span className="ml-auto shrink-0 text-[8px] uppercase opacity-60">{suffix}</span>}
    </div>
  );
}

/** The death-save bubbles: three for each half, empty as a printed sheet is. */
export function Bubbles({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.1em]">
      <span className="w-16 shrink-0 text-right opacity-70">{label}</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            style={{ borderColor: INK }}
            className="inline-block h-3 w-3 rounded-full border"
          />
        ))}
      </span>
    </div>
  );
}

/** An empty box the player fills in at the table: current hit points, XP. */
export function Blank({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Box label={label} className={className}>
      <p className="py-1.5 text-center text-sm">&nbsp;</p>
    </Box>
  );
}

/** A titled area with ruled lines, the way the sheet holds a list. */
export function Panel({
  title,
  children,
  className = "",
  dashed,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <div className={className}>
      <div
        style={{ borderColor: INK, borderStyle: dashed ? "dashed" : "solid" }}
        className="min-h-[64px] border px-3 py-2"
      >
        {children}
      </div>
      <Caption className="mt-0.5">{title}</Caption>
    </div>
  );
}

/** Lines of text inside a panel, or the dash a printed sheet leaves. */
export function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <p className="text-[11px] italic opacity-50">—</p>;

  return (
    <ul className="space-y-0.5">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`} className="text-[11px] leading-snug">
          {line}
        </li>
      ))}
    </ul>
  );
}
