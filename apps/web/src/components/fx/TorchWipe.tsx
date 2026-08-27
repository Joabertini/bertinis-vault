import { motion, AnimatePresence } from "framer-motion";

export default function TorchWipe({ trigger }: { trigger: number }) {
  return (
    <AnimatePresence>
      <motion.div
        key={trigger}
        initial={{ x: "-120%" }}
        animate={{ x: "120%" }}
        transition={{ duration: 0.9, ease: [0.83, 0, 0.17, 1] }}
        className="pointer-events-none fixed inset-y-0 z-[65] w-[60vw]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(110,15,15,0.25) 30%, rgba(255,90,31,0.35) 48%, rgba(230,223,206,0.5) 50%, rgba(255,90,31,0.35) 52%, rgba(110,15,15,0.25) 70%, transparent 100%)",
          filter: "blur(6px)",
          mixBlendMode: "screen",
        }}
      />
    </AnimatePresence>
  );
}
