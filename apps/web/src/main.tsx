import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Gate from "@/routes/Gate";

/*
 * The working rooms load when they are entered.
 *
 * The Gate is the door: it shows the title and asks whether you are starting
 * or continuing. It has no business waiting for the Forge's chambers, the
 * Codex's tomes and the Ritual's export to parse before it can paint.
 */
const Forge = lazy(() => import("@/routes/Forge"));
const Codex = lazy(() => import("@/routes/Codex"));
const Ritual = lazy(() => import("@/routes/Ritual"));
// A borrowed tome: someone else's code, opened as a character. Lazy like the
// rest — most visits never reach it, and it pulls the whole Vision with it.
const SharedTome = lazy(() => import("@/routes/SharedTome"));
// Order is the cascade: Tailwind's layers first, then the rules that override
// its preflight. See the note at the top of globals.css.
import "./styles/globals.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Nothing on purpose: the swap is a frame or two on a warm cache, and
          a spinner that flashes is worse than a beat of the page you left. */}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Gate />} />
          <Route path="/forge" element={<Forge />} />
          <Route path="/codex" element={<Codex />} />
          <Route path="/ritual" element={<Ritual />} />
          <Route path="/tomo/:code" element={<SharedTome />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
