import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function RuneButton({
  children, onClick, variant = "gold", className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "gold" | "blood" | "ghost";
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 });
  const y = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 });

  const styles = {
    gold: "border-[#B08A3E]/50 text-[#E6DFCE] hover:text-[#B08A3E] shadow-[inset_0_0_20px_rgba(176,138,62,0.08)]",
    blood: "border-[#6E0F0F]/70 text-[#E6DFCE] bg-[#6E0F0F]/15 hover:bg-[#6E0F0F]/35",
    ghost: "border-[#4A4640] text-bone/75 hover:text-[#E6DFCE]",
  }[variant];

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.15);
        y.set((e.clientY - r.top - r.height / 2) * 0.15);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.96 }}
      style={{ x, y }}
      className={`group relative overflow-hidden border px-12 py-4 font-display text-sm font-semibold uppercase tracking-[0.25em] backdrop-blur-sm transition-all duration-500 ${styles} ${className}`}
    >
      {/* corner runes */}
      <span className="absolute left-2 top-2 h-2 w-2 border-l border-t border-current opacity-40 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-90" />
      <span className="absolute right-2 top-2 h-2 w-2 border-r border-t border-current opacity-40 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-90" />
      <span className="absolute left-2 bottom-2 h-2 w-2 border-b border-l border-current opacity-40 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-90" />
      <span className="absolute right-2 bottom-2 h-2 w-2 border-b border-r border-current opacity-40 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-90" />

      {/* sweep shine */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <span className="relative">{children}</span>
    </motion.button>
  );
}

export default RuneButton;
