

/**
 * Back and forward, pinned to the edges of the screen.
 *
 * The footer already carries both, and the footer is at the bottom: a player
 * in the middle of a long chamber has to scroll past everything to move on.
 * These do not scroll, so the way out is always where the player last saw it.
 *
 * Only from `xl` up. The page is `max-w-6xl` (1152px) centred, so above
 * 1280px there is real margin either side to sit in; below it these would
 * float over the chamber itself, and an arrow covering the question it is
 * asking about is worse than an arrow you scroll to. The footer stays as it
 * is at every width, so nothing is lost when they are absent.
 *
 * Disabled rather than removed at the ends of the rail — an arrow that
 * vanishes on the last chamber moves the other one, and a control that moves
 * is a control you have to find again.
 */
export default function ChamberArrows({
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  accent,
}: {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  accent: string;
}) {
  const base =
    "fixed top-1/2 z-20 hidden h-14 w-11 -translate-y-1/2 items-center justify-center border border-iron/60 bg-void font-display text-2xl text-bone transition-colors enabled:hover:text-bone disabled:opacity-25 xl:flex";

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Camara anterior"
        className={`${base} left-2`}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Camara siguiente"
        className={`${base} right-2`}
        style={canGoNext ? { borderColor: `${accent}66` } : undefined}
      >
        ›
      </button>
    </>
  );
}
