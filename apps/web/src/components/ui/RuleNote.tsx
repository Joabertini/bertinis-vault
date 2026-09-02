/**
 * The rule behind a panel, on request.
 *
 * Every chamber used to carry its explanation as a paragraph under the label:
 * what expertise multiplies, why point buy charges double past 13, what a hit
 * die is. Eight of them, always on, in a dimmed italic — so the page read as
 * a wall of grey to a veteran who needed none of it, and was still hard to
 * read for the newcomer it was written for.
 *
 * The text is worth keeping; the shelf space is not. It lives behind a mark
 * next to the label and opens as a card over the page, set at a size and a
 * contrast meant to be read rather than sensed.
 *
 * Fixed to the viewport through a portal rather than absolutely inside the
 * panel: the Living Record and several chambers scroll inside their own box,
 * and a card positioned within one is clipped by it.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { LABEL } from "@/styles/recipes";

/** Distance from the mark to the card, and from the card to the viewport. */
const GAP = 10;
const MARGIN = 12;

export default function RuleNote({
  title,
  children,
}: {
  /** What the rule is called. Also the button's accessible name. */
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const cardId = useId();

  /*
   * Measured after the card exists, because where it goes depends on how big
   * it turned out: below the mark when there is room, above it when there is
   * not, and always clamped inside the viewport.
   */
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }

    const mark = anchor.current?.getBoundingClientRect();
    const box = card.current?.getBoundingClientRect();
    if (!mark || !box) return;

    const below = mark.bottom + GAP;
    const fitsBelow = below + box.height + MARGIN <= window.innerHeight;

    const top = fitsBelow ? below : Math.max(MARGIN, mark.top - GAP - box.height);
    const left = Math.min(
      Math.max(MARGIN, mark.left),
      Math.max(MARGIN, window.innerWidth - box.width - MARGIN),
    );

    setPlacement({ top, left });
  }, [open]);

  /*
   * Escape closes it, and so does scrolling: the card is pinned to the
   * viewport, so a page that moves under it would leave it pointing at
   * nothing. `capture` because the scroll happens on inner boxes too.
   */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        anchor.current?.focus();
      }
    };
    const close = () => setOpen(false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        aria-label={`La regla: ${title}`}
        className={`inline-flex h-[18px] shrink-0 items-center gap-1 border px-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.2em] transition-colors ${
          open
            ? "border-gold bg-gold/15 text-gold"
            : "border-iron text-bone/60 hover:border-gold hover:text-gold"
        }`}
      >
        <span aria-hidden>?</span>
        <span>regla</span>
      </button>

      {open &&
        createPortal(
          <>
            {/*
             * Catches the click that closes the card. Transparent rather than
             * dimmed: this is an aside, not a decision, and darkening the page
             * behind it would claim more attention than the card deserves.
             */}
            <div
              className="fixed inset-0 z-[90]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              ref={card}
              id={cardId}
              role="dialog"
              aria-label={title}
              style={{
                top: placement?.top ?? 0,
                left: placement?.left ?? 0,
                // Hidden until measured, so it never flashes at the corner.
                opacity: placement ? 1 : 0,
              }}
              className="fixed z-[91] w-[min(22rem,calc(100vw-24px))] border border-gold/40 bg-ash p-5 shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
            >
              <p className={`${LABEL} mb-2`}>{title}</p>
              <div className="space-y-2 font-body text-[15px] leading-relaxed text-bone/75">
                {children}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
