/**
 * The roll tray: where every roll of the table lands.
 *
 * The sheet used to drop a card inside itself for each roll, on top of the thing being read. Here
 * they all arrive in one window of their own, which can be moved out of the way, and which also
 * rolls whatever the player types: "2d6+3", a d20 with advantage.
 *
 * It floats above the page and does not block what is behind it. It is drawn into the body: the
 * windows it sits beside move with a CSS transform, and a fixed element inside one moves with it.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { isFormula, rollFormula, type RollMode } from "@/lib/roll-formula";
import { useRolls, type RollEntry } from "@/lib/roll-store";

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
const MODES: Array<[RollMode, string]> = [
  ["desventaja", "Desventaja"],
  ["normal", "Normal"],
  ["ventaja", "Ventaja"],
];

function tone(entry: RollEntry): string {
  if (entry.d20 === 20) return "#6fe08a";
  if (entry.d20 === 1) return "#ff7a7a";
  return "#ffffff";
}

export default function RollTray({ accent = "#F2C14E" }: { accent?: string }) {
  const rolls = useRolls((s) => s.rolls);
  const push = useRolls((s) => s.push);
  const clear = useRolls((s) => s.clear);
  const [mode, setMode] = useState<RollMode>("normal");
  const [formula, setFormula] = useState("");
  const [open, setOpen] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const seen = useRef(0);

  // A roll that arrives while the tray is folded opens it: the point is to see the result.
  useEffect(() => {
    const newest = rolls[0]?.id ?? 0;
    if (newest > seen.current) setOpen(true);
    seen.current = newest;
  }, [rolls]);

  const throwDie = (text: string, title: string) => {
    if (!isFormula(text)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const result = rollFormula(text, mode);
    push({
      titulo: title,
      formula: text.replace(/\s+/g, ""),
      total: result.total,
      detalle: result.pair ? `${result.detalle} (${result.pair.join(" / ")})` : result.detalle,
      modo: mode,
      d20: result.d20,
      aviso: null,
    });
  };

  const latest = rolls[0];

  return createPortal(
    <motion.aside
      drag
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto fixed bottom-4 right-4 z-[60] w-[290px] select-none border bg-[#0d0b0b]/95 shadow-[0_8px_30px_rgba(0,0,0,0.7)] backdrop-blur"
      style={{ borderColor: `${accent}66` }}
      aria-label="Bandeja de dados"
    >
      <header
        className="flex cursor-grab items-center gap-2 border-b px-3 py-1.5 active:cursor-grabbing"
        style={{ borderColor: `${accent}33`, background: `${accent}14` }}
      >
        <span className="flex-1 font-display text-[13px] font-bold uppercase tracking-[0.12em] text-bone">Dados</span>
        {rolls.length > 0 && (
          <button
            onPointerDown={(event) => event.stopPropagation()}
            onClick={clear}
            className="font-mono text-[11px] uppercase text-bone/60 hover:text-bone"
          >
            Limpiar
          </button>
        )}
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Plegar la bandeja" : "Abrir la bandeja"}
          className="w-5 text-center font-mono text-[15px] leading-none text-bone/70 hover:text-bone"
        >
          {open ? "–" : "+"}
        </button>
      </header>

      {open && (
        <div className="select-text">
          <div className="min-h-[92px] px-3 py-3 text-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {latest ? (
                <motion.div
                  key={latest.id}
                  initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                >
                  <p className="truncate font-mono text-[12px] uppercase tracking-[0.08em] text-bone/70">{latest.titulo}</p>
                  {latest.total !== null ? (
                    <>
                      <p className="font-display text-[44px] font-bold leading-none" style={{ color: tone(latest) }}>
                        {latest.total}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-bone/60">
                        {latest.formula} · {latest.detalle}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 font-body text-[14px] text-bone">{latest.aviso}</p>
                  )}
                </motion.div>
              ) : (
                <p className="pt-6 font-mono text-[12px] text-bone/50">Todavía no tiraste nada.</p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-1 px-3 pb-2">
            {DICE.map((sides) => (
              <button
                key={sides}
                onClick={() => throwDie(`1d${sides}`, `d${sides}`)}
                className="flex-1 border border-iron/50 bg-black/40 py-1 font-mono text-[12px] font-bold text-bone transition-colors hover:border-[#F2C14E] hover:text-[#F2C14E]"
              >
                {sides}
              </button>
            ))}
          </div>

          <div className="flex gap-1 px-3 pb-2">
            {MODES.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className="flex-1 border py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors"
                style={
                  mode === id
                    ? { borderColor: accent, color: accent, background: `${accent}1f` }
                    : { borderColor: "rgba(120,120,120,0.4)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <form
            className="flex gap-1 px-3 pb-3"
            onSubmit={(event) => {
              event.preventDefault();
              throwDie(formula, formula.trim());
            }}
          >
            <input
              value={formula}
              onChange={(event) => {
                setFormula(event.target.value);
                setInvalid(false);
              }}
              placeholder="2d6+3"
              aria-label="Fórmula de dados"
              className="min-w-0 flex-1 border bg-black/50 px-2 py-1 font-mono text-[13px] text-bone outline-none placeholder:text-bone/30"
              style={{ borderColor: invalid ? "#ff7a7a" : "rgba(120,120,120,0.5)" }}
            />
            <button type="submit" className="border px-3 font-mono text-[12px] font-bold uppercase" style={{ borderColor: accent, color: accent }}>
              Tirar
            </button>
          </form>

          {rolls.length > 1 && (
            <ol className="max-h-[170px] overflow-auto border-t border-iron/30 px-3 py-2">
              {rolls.slice(1).map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-2 py-0.5 font-mono text-[11px] text-bone/70">
                  <span className="min-w-0 flex-1 truncate">{entry.titulo}</span>
                  {entry.total !== null ? (
                    <b className="text-[13px]" style={{ color: tone(entry) }} title={`${entry.formula} · ${entry.detalle}`}>
                      {entry.total}
                    </b>
                  ) : (
                    <span className="max-w-[140px] truncate italic text-bone/50">{entry.aviso}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </motion.aside>,
    document.body,
  );
}
