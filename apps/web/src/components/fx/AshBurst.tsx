import { useEffect, useRef } from "react";

export default function AshBurst({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    interface P { x: number; y: number; vx: number; vy: number; r: number; life: number; phase: "fire" | "ash"; }
    const parts: P[] = Array.from({ length: 90 }, () => ({
      x: origin.x * dpr,
      y: origin.y * dpr,
      vx: (Math.random() - 0.5) * 4 * dpr,
      vy: -(Math.random() * 3 + 1) * dpr,
      r: (Math.random() * 2 + 0.5) * dpr,
      life: 1,
      phase: Math.random() > 0.4 ? "fire" : "ash",
    }));

    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        // fire rises, ash falls after mid-life
        if (p.phase === "ash") p.vy += 0.05 * dpr;
        else p.vy *= 0.985;
        p.vx *= 0.99;
        p.life -= 0.012;
        const a = Math.max(p.life, 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        ctx.fillStyle =
          p.phase === "fire"
            ? `rgba(255,${Math.floor(90 + 130 * a)},31,${a * 0.8})`
            : `rgba(160,155,145,${a * 0.5})`;
        ctx.fill();
      }
      frame++;
      if (frame < 140) requestAnimationFrame(tick);
      else onDone();
    };
    tick();
  }, [origin, onDone]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[90]" aria-hidden />;
}
