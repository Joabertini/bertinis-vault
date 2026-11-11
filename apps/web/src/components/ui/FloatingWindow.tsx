/**
 * A window inside the page, the way a virtual tabletop opens one.
 *
 * Not a modal: nothing behind it is dimmed or blocked, because a sheet is
 * something you keep open beside the table while you do other things — which
 * is the whole reason roll20's is a window and not a page. It is dragged by
 * its title bar, resized from its corner, and Escape closes it.
 *
 * Below `md` it stops floating and fills the screen. Dragging a window with a
 * thumb on a phone is a fight, and a 900px window on a 390px screen is not a
 * window, it is a page that hid its edges.
 *
 * **The drag belongs to framer-motion and not to this file.** It was written
 * once with pointer handlers writing `transform: translate(...)` into the
 * inline style, and the window could be resized and never moved: this element
 * is a `motion.div` that animates its own scale on open, so framer owns
 * `transform` and overwrote every offset on the next frame. Two owners for one
 * property is a bug that looks like a dead control.
 *
 * The centring lives on the wrapper for the same reason — a `-translate-1/2`
 * on the window itself would be the third writer to that property.
 */

import { useEffect, useRef } from "react";
import { motion, useDragControls } from "framer-motion";

export default function FloatingWindow({
  title,
  subtitle,
  accent = "#F2C14E",
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
  const bounds = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={bounds}
      /* Lets clicks through to the page behind, so the window is a window and
         not a modal wearing one's clothes. The window itself takes them back. */
      className="pointer-events-none fixed inset-0 z-[90] flex md:items-center md:justify-center"
    >
      <motion.div
        role="dialog"
        aria-label={title}
        drag
        // Only the title bar starts a drag. Without this the whole window
        // drags, and selecting a line of the sheet would move it instead.
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={bounds}
        dragMomentum={false}
        dragElastic={0}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{
          borderColor: `${accent}55`,
          boxShadow: `0 30px 90px rgba(0,0,0,0.75), inset 0 0 60px ${accent}08`,
        }}
        className="pointer-events-auto flex h-full w-full flex-col border bg-[#000000] md:h-auto md:max-h-[86vh] md:w-auto md:resize md:overflow-auto"
      >
        <div
          onPointerDown={(event) => {
            // Only the primary button drags: a right-click on the bar is a
            // context menu, and a window that ran from one would be a bug.
            if (event.button === 0) dragControls.start(event);
          }}
          style={{ background: `${accent}1a`, borderColor: `${accent}44` }}
          className="flex shrink-0 select-none items-center gap-4 border-b px-4 py-2.5 md:cursor-grab md:active:cursor-grabbing"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold text-bone">{title}</p>
            {subtitle && (
              <p className="truncate font-mono text-[13px] tracking-[0.1em] text-bone">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 px-2 font-mono text-[15px] text-bone transition-colors hover:text-ember"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="md:w-[--window-width]" style={{ ["--window-width" as string]: `${width}px` }}>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
