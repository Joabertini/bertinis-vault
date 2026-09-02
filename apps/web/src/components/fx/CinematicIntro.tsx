import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function CinematicIntro({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"intro" | "done">("intro");

  return (
    <>
      <AnimatePresence>
        {phase === "intro" && (
          <>
            <motion.div exit={{ height: 0 }} transition={{ duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
              className="fixed inset-x-0 top-0 z-[70] bg-black" initial={{ height: "50vh" }} />
            <motion.div exit={{ height: 0 }} transition={{ duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
              className="fixed inset-x-0 bottom-0 z-[70] bg-black" initial={{ height: "50vh" }} />

            {/* Carved title */}
            <motion.div exit={{ opacity: 0, scale: 1.15, filter: "blur(8px)" }}
              transition={{ duration: 0.7 }}
              className="fixed inset-0 z-[71] flex items-center justify-center">
              <div className="text-center">
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }}
                  className="font-mono text-[10px] tracking-[0.6em] uppercase text-gold/85">
                  La luz que no se apaga
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, letterSpacing: "0.6em", filter: "blur(12px)" }}
                  animate={{ opacity: 1, letterSpacing: "0.12em", filter: "blur(0px)" }}
                  transition={{ delay: 0.6, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                  // The tracking animation closes the word gap along with the
                  // letters, so it is widened to survive the landing.
                  style={{ wordSpacing: "0.3em" }}
                  className="mt-4 font-title text-5xl md:text-7xl font-normal text-bone"
                >
                  FARO DEL ALBA
                </motion.h1>
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ delay: 1.4, duration: 0.8 }}
                  className="mx-auto mt-6 h-px w-40 bg-gradient-to-r from-transparent via-[#B08A3E] to-transparent" />
              </div>
            </motion.div>

            {/* Auto-dismiss */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 2.4 }}
              onAnimationComplete={() => setTimeout(() => setPhase("done"), 600)}
              className="fixed bottom-10 left-1/2 z-[72] -translate-x-1/2 font-mono text-[10px] tracking-[0.4em] uppercase text-bone/60"
            >
              click to enter
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <div onClick={() => setPhase("done")} className={phase === "intro" ? "cursor-wait h-screen overflow-hidden" : ""}>
        {children}
      </div>
    </>
  );
}
