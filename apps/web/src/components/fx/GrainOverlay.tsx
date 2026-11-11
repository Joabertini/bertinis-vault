/**
 * The vignette: the page darkens toward its edges.
 *
 * It used to carry a film grain too. It was a static tile of white specks over
 * the whole page and it read as dirt on the screen, so it is gone; the name
 * stays because every page already mounts this component.
 */

export default function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[59]"
      style={{
        background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
      }}
    />
  );
}
