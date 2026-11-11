import { useEffect, useRef } from "react";

/**
 * Embers drifting up the page.
 *
 * Cheap on purpose: each glow is drawn from a sprite made once (the old code
 * asked the canvas for a blurred shadow on every particle on every frame, and
 * a canvas shadow is a full blur pass each time), the canvas is capped at one
 * device pixel per CSS pixel, and the loop stops while the tab is hidden or
 * the visitor has asked their system for less motion.
 */

const COLORS = [
  { rgb: "255,112,67", weight: 0.3 },
  { rgb: "242,193,78", weight: 0.7 },
];
const SPRITE = 32;

function makeSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE;
  sprite.height = SPRITE;
  const ctx = sprite.getContext("2d")!;
  const glow = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  glow.addColorStop(0, `rgba(${rgb},1)`);
  glow.addColorStop(0.25, `rgba(${rgb},0.55)`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  return sprite;
}

export default function EmberField({ density = 36 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sprites = COLORS.map((c) => makeSprite(c.rgb));
    let raf = 0;
    let last = 0;
    let running = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface P { x: number; y: number; vx: number; vy: number; r: number; sprite: number; phase: number; }
    const spawn = (fromBottom = true): P => ({
      x: Math.random() * canvas.width,
      y: fromBottom ? canvas.height + Math.random() * 100 : Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.7),
      r: 2 + Math.random() * 4,
      sprite: Math.random() < COLORS[0]!.weight ? 0 : 1,
      phase: Math.random() * 6.28,
    });
    const parts: P[] = Array.from({ length: density }, () => spawn(false));

    const draw = (now: number) => {
      // Thirty frames a second is plenty for something this soft.
      if (now - last >= 33) {
        const step = last === 0 ? 1 : Math.min((now - last) / 16.7, 3);
        last = now;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of parts) {
          p.x += (p.vx + Math.sin(p.y * 0.01) * 0.2) * step;
          p.y += p.vy * step;
          if (p.y < -20) Object.assign(p, spawn());
          ctx.globalAlpha = (0.4 + Math.abs(Math.sin(now * 0.002 + p.phase)) * 0.6) * 0.7;
          ctx.drawImage(sprites[p.sprite]!, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running || reduce.matches || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const sync = () => (document.hidden || reduce.matches ? stop() : start());

    document.addEventListener("visibilitychange", sync);
    reduce.addEventListener("change", sync);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      reduce.removeEventListener("change", sync);
    };
  }, [density]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[1] h-full w-full opacity-70" aria-hidden />;
}
