/**
 * A window inside the page, the way a virtual tabletop opens one.
 *
 * Not a modal: nothing behind it is dimmed or blocked, because a sheet is
 * something you keep open beside the table while you do other things — which
 * is the whole reason roll20's is a window and not a page. It can be dragged
 * by its title bar and resized from its corner, and Escape closes it.
 *
 * Below `md` it stops floating and fills the screen. Dragging a window with a
 * thumb on a phone is a fight, and a 700px window on a 390px screen is not a
 * window, it is a page that hid its edges.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Point = { x: number; y: number };

export default function FloatingWindow({
  title,
  subtitle,
  accent = "#B08A3E",
  width = 880,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The class tint, so an open window says whose it is at a glance. */
  accent?: string;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragFrom = useRef<Point | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only the primary button drags. A right-click on the title bar is a
      // context menu, and a window that ran away from one would be a bug.
      if (event.button !== 0) return;
      dragFrom.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
      // Capture is an optimisation, not the mechanism: it keeps the drag alive
      // when the pointer outruns the bar. Guarded because not every engine
      // implements it — jsdom does not — and a window that cannot be dragged
      // is a smaller loss than one that throws on mousedown.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [offset],
  );

  const onDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const from = dragFrom.current;
    if (!from) return;

    /*
     * Clamped to the viewport, with a margin that keeps the title bar
     * reachable. A window dragged off the top edge cannot be dragged back:
     * the only handle it has is the bar that just left the screen.
     */
    const margin = 80;
    setOffset({
      x: clamp(event.clientX - from.x, -window.innerWidth / 2 + margin, window.innerWidth / 2 - margin),
      y: clamp(event.clientY - from.y, -window.innerHeight / 2 + margin, window.innerHeight / 2 - margin),
    });
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-label={title}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      style={{
        borderColor: `${accent}55`,
        boxShadow: `0 30px 90px rgba(0,0,0,0.75), inset 0 0 60px ${accent}08`,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      className="fixed inset-0 z-[90] flex flex-col border bg-[#0c0a08] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86vh] md:-translate-x-1/2 md:-translate-y-1/2 md:resize md:overflow-auto"
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ background: `${accent}1a`, borderColor: `${accent}44` }}
        className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5 md:cursor-grab md:active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-bone">{title}</p>
          {subtitle && (
            <p className="truncate font-mono text-[10px] tracking-[0.2em] text-bone/60">{subtitle}</p>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 px-2 font-mono text-sm text-bone/60 transition-colors hover:text-ember"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ width: "100%", maxWidth: "100vw" }}>
        <div className="md:w-[--window-width]" style={{ ["--window-width" as string]: `${width}px` }}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
