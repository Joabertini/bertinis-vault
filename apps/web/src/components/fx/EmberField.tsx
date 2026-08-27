import { useEffect, useRef } from "react";

export default function EmberField({ density = 40 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    interface P { x: number; y: number; vx: number; vy: number; r: number; life: number; hue: string; }
    const spawn = (): P => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.7),
      r: (0.6 + Math.random() * 1.8) * dpr,
      life: 1,
      hue: Math.random() > 0.7 ? "255,90,31" : "176,138,62",
    });

    const parts: P[] = Array.from({ length: density }, () => {
      const p = spawn();
      p.y = Math.random() * canvas.height;
      return p;
    });

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.y * 0.01) * 0.2;
        p.y += p.vy;
        if (p.y < -20) Object.assign(p, spawn());
        // flicker
        const flicker = 0.4 + Math.abs(Math.sin(Date.now() * 0.002 + p.x)) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${(flicker * 0.55).toFixed(3)})`;
        ctx.shadowBlur = p.r * 4;
        ctx.shadowColor = `rgba(${p.hue},0.8)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [density]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[1] opacity-70" aria-hidden />;
}
