import { ICON_COLS, ICON_SHEET_KEYS, ICON_SILHOUETTES, type SilhouetteIconKey } from "@/lib/icon-atlas";
import { silhouetteFill } from "@/lib/icons";
import { isSheetIcon, type IconKey } from "@/lib/icons";

/**
 * An item, spell or rules icon at `size` px.
 *
 * Painted icons are one cell of a single sprite sheet, so a list of two hundred
 * rows is one image request. A silhouette is drawn in gold on a dark tile with a
 * thin edge, the same footing as the painted ones, so the two read as a set.
 */
export default function GameIcon({
  icon,
  size = 32,
  label,
  className,
}: {
  icon: IconKey;
  size?: number;
  /** Spoken name; omit when the row already says it, so it is not read twice. */
  label?: string;
  className?: string;
}) {
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  if (isSheetIcon(icon)) {
    const index = ICON_SHEET_KEYS.indexOf(icon);
    const col = index % ICON_COLS;
    const row = Math.floor(index / ICON_COLS);
    return (
      <span
        {...a11y}
        className={className}
        style={{
          display: "inline-block",
          flex: "none",
          width: size,
          height: size,
          borderRadius: Math.max(3, size / 8),
          backgroundColor: "#0d0b0b",
          backgroundImage: "url(/icons/atlas.webp)",
          backgroundRepeat: "no-repeat",
          backgroundSize: `${ICON_COLS * size}px auto`,
          backgroundPosition: `${-col * size}px ${-row * size}px`,
        }}
      />
    );
  }

  return (
    <svg {...a11y} className={className} viewBox="0 0 512 512" width={size} height={size} style={{ flex: "none" }}>
      <rect x="8" y="8" width="496" height="496" rx="64" fill="#15151b" stroke="#9f9275" strokeOpacity="0.45" strokeWidth="10" />
      <path d={ICON_SILHOUETTES[icon as SilhouetteIconKey]} fill={silhouetteFill(icon)} transform="translate(64 64) scale(0.75)" />
    </svg>
  );
}
