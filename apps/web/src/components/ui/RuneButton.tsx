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
    // Opaque on purpose: these sit over the animated background, and a
    // translucent button lets the streaks run through its label.
    gold: "border-[#F2C14E] bg-[#17120A] text-[#FFFFFF] hover:bg-[#241C0D] hover:text-[#F2C14E]",
    blood: "border-[#A32020] bg-[#3A0D0D] text-[#FFFFFF] hover:bg-[#551212]",
    ghost: "border-[#8A8A8A] bg-[#0B0B0B] text-bone hover:bg-[#161616] hover:text-[#FFFFFF]",
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
      className={`group relative overflow-hidden border px-12 py-4 font-display text-[15px] font-semibold uppercase tracking-[0.1em] transition-all duration-500 ${styles} ${className}`}
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
