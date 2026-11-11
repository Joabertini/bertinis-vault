import { lazy, memo, Suspense } from "react";

import EmberField from "./EmberField";

/**
 * The page background: Lightfall behind everything.
 *
 * Loaded lazily so the landing paints before the shader code arrives, mounted
 * once with constant props so a parent re-render never re-runs it, and drawn at
 * one device pixel per CSS pixel because a full-screen shader with bloom is the
 * heaviest thing on the page. Without WebGL2 (or in the test DOM) it falls
 * back to the ember canvas the pages used before.
 */

const Lightfall = lazy(() => import("./Lightfall"));

const COLORS = ["#c3b9ad", "#bd5b02", "#cd2f2f"];

const SHARED = {
  colors: COLORS,
  backgroundColor: "#4f1707",
  streakCount: 5,
  streakWidth: 1.1,
  twinkle: 0.25,
  backgroundGlow: 0.04,
  headGlow: 0.15,
  bloom: 0.65,
  mouseInteraction: true,
  streakLength: 1.4,
  glow: 2,
  depth: 1.8,
  zoom: 1.8,
  mouseStrength: 0.55,
  mouseRadius: 0.15,
  fade: 0.05,
  dpr: 1,
};

/** The landing, exactly as picked; the Forge keeps it calmer so text stays readable. */
const VARIANTS = {
  gate: { ...SHARED, speed: 0.85, holdToWarp: true, intro: true, opacity: 1 },
  forge: { ...SHARED, speed: 0.5, holdToWarp: false, intro: false, opacity: 0.6 },
} as const;

function supportsLightfall(): boolean {
  return (
    typeof WebGL2RenderingContext !== "undefined" &&
    typeof ResizeObserver !== "undefined" &&
    typeof IntersectionObserver !== "undefined"
  );
}

function LightfallBackdrop({
  variant,
  fallbackDensity,
}: {
  variant: keyof typeof VARIANTS;
  fallbackDensity: number;
}) {
  if (!supportsLightfall()) return <EmberField density={fallbackDensity} />;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Suspense fallback={null}>
        <Lightfall {...VARIANTS[variant]} />
      </Suspense>
    </div>
  );
}

export default memo(LightfallBackdrop);
