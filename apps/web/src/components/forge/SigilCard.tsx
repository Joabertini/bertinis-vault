/**
 * One card in a chamber's grid.
 *
 * Lifted out of the Forge unchanged in behaviour so both the Ancestry and the
 * Calling chambers draw from the same component: the class tint is the only
 * thing that differs between them, and it arrives as `accent`.
 */

import { motion } from "framer-motion";

export default function SigilCard({
  children,
  label,
  note,
  active,
  accent,
  onClick,
  compact = false,
}: {
  children: React.ReactNode;
  label: string;
  /** The book, or a line of lore. Shown small, under the name. */
  note?: string | undefined;
  active: boolean;
  accent: string;
  onClick: () => void;
  /**
   * Tighter, for the shelves that show a whole catalog at once.
   *
   * A hundred and sixty species at the full card size is a page nobody
   * scrolls to the end of; the same cards at this size fit nine to a view.
   */
  compact?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`group relative overflow-hidden border text-left transition-all duration-500 ${
        compact ? "p-3.5" : "p-6"
      }`}
      style={{
        borderColor: active ? `${accent}99` : "rgba(74,70,64,0.4)",
        background: active ? `linear-gradient(160deg, ${accent}14, #12100D)` : "rgba(18,16,13,0.8)",
        boxShadow: active ? `0 0 32px ${accent}26, inset 0 0 24px ${accent}0f` : "none",
      }}
    >
      {/* corner marks */}
      <span
        className="absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l border-t transition-colors"
        style={{ borderColor: active ? accent : "#4A4640" }}
      />
      <span
        className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r transition-colors"
        style={{ borderColor: active ? accent : "#4A4640" }}
      />

      <div
        style={{ color: active ? accent : "#8a857c" }}
        className="transition-colors duration-500"
      >
        {children}
      </div>

      <p
        className={`font-display font-bold uppercase ${
          compact ? "mt-2 text-[11px] leading-tight tracking-[0.12em]" : "mt-4 text-sm tracking-[0.2em]"
        }`}
        style={{ color: active ? accent : "#E6DFCE" }}
      >
        {label}
      </p>

      {note && (
        <p
          className={`font-body italic leading-snug text-bone/35 ${
            compact ? "mt-0.5 text-[10px]" : "mt-1.5 text-sm"
          }`}
        >
          {note}
        </p>
      )}

      {/* ignite sweep */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </motion.button>
  );
}
