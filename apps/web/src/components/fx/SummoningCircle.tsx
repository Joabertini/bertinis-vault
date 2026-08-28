import { motion } from "framer-motion";

export default function SummoningCircle({
  size = 320,
  active,
  accent = "#B08A3E",
}: {
  size?: number;
  active: boolean;
  accent?: string;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer ring — slow clockwise */}
      <motion.svg
        viewBox="0 0 200 200"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke={accent} strokeWidth="0.7" opacity="0.5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke={accent} strokeWidth="0.5"
          strokeDasharray="2 6" opacity="0.7" />
        {/* rune ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <line key={i}
              x1={100 + Math.cos(a) * 84} y1={100 + Math.sin(a) * 84}
              x2={100 + Math.cos(a) * 88} y2={100 + Math.sin(a) * 88}
              stroke={accent} strokeWidth="1" opacity="0.6" />
          );
        })}
      </motion.svg>

      {/* Middle ring — counter-clockwise */}
      <motion.svg
        viewBox="0 0 200 200"
        animate={{ rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[14%]"
      >
        <circle cx="100" cy="100" r="92" fill="none" stroke="#6E0F0F" strokeWidth="0.8"
          strokeDasharray="20 10 4 10" opacity="0.65" />
        <polygon points="100,18 176,150 24,150" fill="none" stroke="#6E0F0F" strokeWidth="0.7" opacity="0.5" />
        <polygon points="100,182 24,50 176,50" fill="none" stroke="#6E0F0F" strokeWidth="0.7" opacity="0.5" />
      </motion.svg>

      {/* Inner ring — fast, ignites when active */}
      <motion.svg
        viewBox="0 0 200 200"
        animate={{ rotate: 360 }}
        transition={{ duration: active ? 6 : 16, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[28%]"
      >
        <circle cx="100" cy="100" r="88" fill="none"
          stroke={active ? "#FF5A1F" : accent}
          strokeWidth={active ? 1.4 : 0.6}
          style={{ filter: active ? "drop-shadow(0 0 6px #FF5A1F)" : undefined }}
          strokeDasharray="1 9" />
      </motion.svg>

      {/* Center glow when ritual fires */}
      {active && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1], opacity: [0, 0.9, 0.35] }}
          transition={{ duration: 1.2 }}
          className="absolute inset-[38%] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,90,31,0.7), rgba(110,15,15,0.3) 60%, transparent)",
            filter: "blur(4px)",
          }}
        />
      )}
    </div>
  );
}
