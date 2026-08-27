import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Gate from "@/routes/Gate";
import Forge from "@/routes/Forge";
import Codex from "@/routes/Codex";
import Ritual from "@/routes/Ritual";
// Order is the cascade: Tailwind's layers first, then the rules that override
// its preflight. See the note at the top of globals.css.
import "./styles/globals.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gate />} />
        <Route path="/forge" element={<Forge />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/ritual" element={<Ritual />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
