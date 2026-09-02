/**
 * Stoking the embers — what happens between one chamber and the next.
 *
 * This replaces the torch wipe: a lit band that crossed the screen left to
 * right. The wipe worked as a curtain — the chamber swapped behind it — but it
 * read as a scanner sweeping the page rather than as anything in a forge, and
 * a horizontal line is the one gesture a fire never makes.
 *
 * A poked fire does something specific, and it is worth being literal about
 * it. The bed of coals flares at the bottom. A body of sparks leaves at once —
 * a surge, not a stream — and they leave fast. They climb while they are hot,
 * lose the fight as they cool, and the ones that cool first turn over and fall
 * back. None of them travel straight: the updraft is turbulent, so they curl.
 * They flicker hard the whole way, and they cool from white through orange to
 * a dull red before going out.
 *
 * All of that is cheap to model and none of it is cheap to fake, which is why
 * this is a canvas with real (if small) physics rather than a stack of divs on
 * keyframes. Additive blending is what makes overlapping sparks read as light
 * instead of as paint.
 *
 * The loop stops itself when the last spark dies, so an idle chamber costs
 * nothing.
 */

import { useEffect, useRef } from "react";

/** How long the coal bed stays lit after the poke, in seconds. */
const FLARE_SECONDS = 0.9;

/** Downward pull, in canvas pixels per second squared. */
const GRAVITY = 260;

/**
 * Lift, as a multiple of gravity, on a spark at full heat.
 *
 * Above 1 so a hot spark climbs against gravity and a cooled one gives up and
 * falls — which is the whole reason a fire's sparks arc over instead of just
 * slowing down.
 */
const BUOYANCY = 2.35;

/** Air resistance, expressed as the fraction of speed kept each 1/60s. */
const DRAG = 0.982;

/** Sparks per 1000px of width, so a phone does not get a wall of fire. */
const DENSITY = 78;

/** The three temperatures a spark passes through on its way out. */
const WHITE = [255, 241, 203] as const;
const ORANGE = [255, 134, 40] as const;
const DEEP = [163, 28, 8] as const;

/**
 * How many temperatures get their own pre-drawn sprite.
 *
 * Sixteen steps is below what the eye resolves on a flickering 3px dot, and it
 * is the difference between building a radial gradient once per spark per
 * frame — a hundred allocations every 16ms, which this project's slowest
 * target machine cannot afford — and building sixteen of them once.
 */
const HEAT_STEPS = 16;

/** Side of one sprite in pixels. Drawn once, scaled on use. */
const SPRITE = 64;

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radius in device pixels. */
  size: number;
  /** Seconds lived so far, and the seconds this one gets. */
  age: number;
  life: number;
  /** Phase offset, so no two sparks flicker or curl in step. */
  phase: number;
  /** How hard the updraft pushes this one sideways. */
  sway: number;
};

/** Linear blend between two colour stops. */
function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
  ];
}

/**
 * Colour for a given heat, 1 hot to 0 out.
 *
 * Two segments rather than one: a spark spends very little time white and a
 * long time orange, so the white stop sits up at 0.72 instead of halfway.
 */
function heatColour(heat: number): [number, number, number] {
  return heat > 0.72
    ? mix(ORANGE, WHITE, (heat - 0.72) / 0.28)
    : mix(DEEP, ORANGE, heat / 0.72);
}

/**
 * One spark, drawn once per temperature.
 *
 * Core and halo in a single image: opaque at the centre, most of the falloff
 * spent in the first fifth of the radius, and nothing at the rim. Drawing it
 * scaled is what turns a per-frame gradient into a `drawImage`.
 */
function buildSprites(): HTMLCanvasElement[] {
  const sprites: HTMLCanvasElement[] = [];

  for (let step = 0; step < HEAT_STEPS; step += 1) {
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE;
    sprite.height = SPRITE;

    const ctx = sprite.getContext("2d");
    if (!ctx) continue;

    const [r, g, b] = heatColour(step / (HEAT_STEPS - 1));
    const rgb = `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
    const half = SPRITE / 2;
    const glow = ctx.createRadialGradient(half, half, 0, half, half, half);

    glow.addColorStop(0, `rgba(${rgb},1)`);
    glow.addColorStop(0.18, `rgba(${rgb},0.62)`);
    glow.addColorStop(0.45, `rgba(${rgb},0.16)`);
    glow.addColorStop(1, `rgba(${rgb},0)`);

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SPRITE, SPRITE);
    sprites.push(sprite);
  }

  return sprites;
}

export default function StokeEmbers({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  /** Seconds of coal-bed glow left to burn off. */
  const flare = useRef(0);
  /** Where the poke landed, 0 to 1 across the width. */
  const origin = useRef(0.5);
  /** Set by the mount effect so the trigger effect can wake the loop. */
  const wake = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprites = buildSprites();

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      // First frame of a burst has no previous timestamp; and a tab that was
      // backgrounded comes back with a gap of seconds, which would teleport
      // every spark off the top. Clamped to two frames at 60Hz.
      const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 1 / 30);
      last = now;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      /* ---------- the coal bed, flaring where the poke landed ---------- */

      if (flare.current > 0) {
        flare.current = Math.max(0, flare.current - dt);
        // Eased out: a bed of coals dims fast at first and lingers after.
        const strength = (flare.current / FLARE_SECONDS) ** 1.8;
        const cx = origin.current * width;
        const glow = ctx.createRadialGradient(cx, height, 0, cx, height, height * 0.55);

        glow.addColorStop(0, `rgba(255,148,52,${(strength * 0.3).toFixed(4)})`);
        glow.addColorStop(0.45, `rgba(190,52,14,${(strength * 0.12).toFixed(4)})`);
        glow.addColorStop(1, "rgba(110,15,15,0)");

        ctx.fillStyle = glow;
        // Only the band the gradient actually reaches. Filling the whole
        // canvas every frame is the same picture at twice the fill cost.
        ctx.fillRect(0, height * 0.45, width, height * 0.55);
      }

      /* ---------- the sparks ---------- */

      const alive: Spark[] = [];

      for (const spark of sparks.current) {
        spark.age += dt;
        const heat = 1 - spark.age / spark.life;
        if (heat <= 0) continue;

        // Hot rises, cold falls. The crossover is what bends the arc over.
        spark.vy += GRAVITY * (1 - BUOYANCY * heat) * dt;

        // Two bands of turbulence at different rates: one slow enough to read
        // as a draught, one quick enough to read as a curl.
        spark.vx +=
          (Math.sin(spark.age * 2.3 + spark.phase) * 0.7 +
            Math.sin(spark.age * 6.1 + spark.phase * 1.7) * 0.3) *
          spark.sway *
          dt;

        const kept = DRAG ** (dt * 60);
        spark.vx *= kept;
        spark.vy *= kept;

        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;

        if (spark.y < -40 * dpr) continue;

        // Fast flicker, never all the way to dark: an ember that blinks out
        // and returns reads as a rendering fault rather than as fire.
        const flicker = 0.62 + 0.38 * Math.sin(spark.age * 26 + spark.phase * 3);
        const sprite = sprites[Math.round(heat * (HEAT_STEPS - 1))];

        if (sprite) {
          const reach = spark.size * 5;
          ctx.globalAlpha = Math.min(1, heat * 1.25) * flicker;
          ctx.drawImage(sprite, spark.x - reach, spark.y - reach, reach * 2, reach * 2);
        }

        alive.push(spark);
      }

      sparks.current = alive;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (alive.length > 0 || flare.current > 0) {
        raf = requestAnimationFrame(draw);
      } else {
        // Nothing left to burn: drop the frame loop and leave the canvas clear
        // rather than holding a rAF open for the rest of the session.
        ctx.clearRect(0, 0, width, height);
        raf = 0;
        last = 0;
      }
    };

    wake.current = () => {
      if (raf === 0) {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    };

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      wake.current = null;
      sparks.current = [];
      flare.current = 0;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // A burst of fire flying up the page is exactly what this setting is for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas;

    // Off centre by a little, and a different little each time: a poke lands
    // where the poker happens to be, and a burst that is always centred reads
    // as a UI element rather than as an event.
    origin.current = 0.35 + Math.random() * 0.3;
    flare.current = FLARE_SECONDS;

    const count = Math.round((window.innerWidth / 1000) * DENSITY);
    const born: Spark[] = [];

    for (let index = 0; index < count; index += 1) {
      // Clustered around where the poke landed but reaching the full width,
      // because heat travels along the whole bed. Two random draws averaged
      // gives the cluster without needing a real distribution.
      const spread = (Math.random() + Math.random()) / 2 - 0.5;
      const x = (origin.current + spread * 1.4) * width;

      // Most sparks are motes; a few are the big lazy ones that carry furthest
      // and are the whole reason the effect reads as fire. Cubing the draw is
      // what keeps the big ones rare.
      const heft = Math.random() ** 3;

      born.push({
        x,
        y: height + Math.random() * 30 * dpr,
        vx: (Math.random() - 0.5) * 190 * dpr,
        // The heavier ones leave slower and last longer, which is why they end
        // up highest: buoyancy has more time to work on them.
        vy: -(260 + Math.random() * 520 - heft * 160) * dpr,
        size: (0.7 + heft * 2.6) * dpr,
        age: 0,
        life: 1.1 + Math.random() * 1.3 + heft * 0.9,
        phase: Math.random() * Math.PI * 2,
        sway: (26 + Math.random() * 70) * dpr,
      });
    }

    sparks.current.push(...born);
    wake.current?.();
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[65]"
      aria-hidden
    />
  );
}
