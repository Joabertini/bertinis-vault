/**
 * What this character can actually do on its turn.
 *
 * The cheat sheet, narrowed to one character — its class notes, its subclass
 * among the hundred and one, only the feats it took, and only the
 * combinations those feats and that class actually assemble.
 *
 * Laid out the way the cheat sheet lays itself out: wide, dark, tinted by
 * class, two columns where two columns help and full width where they do not.
 * It was tried once inside the tome's two-page spread and the folio was the
 * wrong shape for it — a column narrow enough to make every note wrap twice,
 * beside a page of whitespace. The book stays on the shelf; what opens out of
 * it is this.
 *
 * Split across three tabs rather than run as one column: Core is what holds
 * whether or not anyone is swinging, Combate is what a turn gets spent on,
 * Movimiento is moving and what moving provokes. Scrolling past a rule to
 * reach the rule beside it is the thing tabs exist to stop.
 *
 * The name and the numbers sit above the tabs, because those are read no
 * matter which one is open.
 *
 * Where the sheet has nothing written — the Artificer, the sidekick classes —
 * the page says so rather than padding with generalities. Same for a tab that
 * a particular character has nothing on.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Sigil from "@/components/sigils/Sigil";
import {
  tabForFeat,
  tabForNote,
  tabForRule,
  type Playbook,
  type PlayNote,
  type VisionTab,
} from "@/lib/playbook";
import { HEADING } from "@/styles/recipes";

/** What each feat costs to use, in the sheet's own vocabulary. */
const CATEGORY_LABEL: Record<string, string> = {
  passive: "pasiva",
  active: "accion",
  bonus_action: "accion adicional",
  reaction: "reaccion",
};

/*
 * The three tabs, in the order a turn happens.
 *
 * Core first because it is the frame: the numbers, the shape of a turn, the
 * rules that hold whether or not anyone is swinging. Then what you spend the
 * turn on, then moving and what moving provokes.
 */
const TABS: Array<{ id: VisionTab; label: string; blurb: string }> = [
  { id: "core", label: "Core", blurb: "Tus numeros y las reglas que valen siempre." },
  { id: "combate", label: "Combate", blurb: "Lo que gastas en tu turno para pegar o ayudar." },
  { id: "movimiento", label: "Movimiento", blurb: "Moverte, y lo que moverse provoca." },
];

export default function Vision({
  playbook,
  accent,
  name,
  subtitle,
  sigilName,
}: {
  playbook: Playbook;
  accent: string;
  name: string;
  /** "Nivel 5 · Humano · Guerrero", already assembled. */
  subtitle: string;
  sigilName: string;
}) {
  const [tab, setTab] = useState<VisionTab>("core");

  /*
   * Everything sorted into its tab once, not on every render and not on every
   * tab change. The classification is pure string work over a few hundred
   * notes, which is cheap, but it is also the same answer every time.
   */
  const sorted = useMemo(() => {
    const on = (which: VisionTab) => ({
      bonusActions: playbook.bonusActions.filter((note) => tabForNote(note) === which),
      reactions: playbook.reactions.filter((note) => tabForNote(note) === which),
      features: playbook.features.filter((note) => tabForNote(note) === which),
      feats: playbook.feats.filter((entry) => tabForFeat(entry.name, entry.note) === which),
      rules: playbook.rules
        .map((block) => ({
          ...block,
          items: block.items.filter((item) => tabForRule(item.label) === which),
        }))
        .filter((block) => block.items.length > 0),
    });

    return { core: on("core"), combate: on("combate"), movimiento: on("movimiento") };
  }, [playbook]);

  const shown = sorted[tab];

  return (
    <div>
      {/* ---- the band across the top: who, and the numbers ---- */}
      <header
        className="border-b px-8 py-6"
        style={{ borderColor: `${accent}33`, background: `linear-gradient(150deg, ${accent}12, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-center gap-5">
          <Sigil name={sigilName} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-black leading-tight text-bone">{name}</h2>
            <p className="mt-1 font-body text-sm italic text-bone/50">
              {subtitle}
              {playbook.role && <span className="text-bone/35"> — {playbook.role}</span>}
            </p>
          </div>
        </div>

        {playbook.vitals.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {playbook.vitals.map((vital) => (
              <div
                key={vital.label}
                className="border border-iron/40 bg-void/50 px-3 py-2"
                title={vital.from}
              >
                <dt className="font-mono text-[8px] uppercase tracking-[0.18em] text-bone/35">
                  {vital.label}
                </dt>
                <dd className="mt-0.5 font-display text-xl font-black" style={{ color: accent }}>
                  {vital.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {playbook.unwritten ? (
        <p className="px-8 py-12 font-body text-sm italic leading-relaxed text-bone/40">
          La hoja de trucos todavia no cubre esta clase. Antes que llenar la pagina con
          generalidades, queda en blanco.
        </p>
      ) : (
        <>
          {/* ---- the tabs ---- */}
          <div
            className="flex flex-wrap items-center gap-1 border-b px-8"
            style={{ borderColor: `${accent}22` }}
            role="tablist"
          >
            {TABS.map((entry) => {
              const active = entry.id === tab;
              return (
                <button
                  key={entry.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(entry.id)}
                  title={entry.blurb}
                  className="relative px-4 py-3 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors"
                  style={{ color: active ? accent : "#8a857c" }}
                >
                  {entry.label}
                  {active && (
                    // One shared element, so the underline slides between tabs
                    // rather than blinking out on one and in on the next.
                    <motion.span
                      layoutId="vision-tab"
                      className="absolute inset-x-2 -bottom-px h-px"
                      style={{ background: accent }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-8 px-8 py-8"
            >
              {/* Only on Core: the sheet's warning that this class is hard to
                  run well is a standing property of the character, not a
                  thing that happens on a turn. */}
              {tab === "core" && playbook.warnings.length > 0 && (
                <div className="space-y-2">
                  {playbook.warnings.map((warning) => (
                    <p
                      key={warning}
                      className="border-l-2 border-ember/60 pl-4 font-body text-sm leading-relaxed text-bone/55"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              {/*
                The two action types side by side, because the choice between
                them is the one a player makes every round.
              */}
              {(shown.bonusActions.length > 0 || shown.reactions.length > 0) && (
                <div className="grid gap-8 md:grid-cols-2">
                  <Section title="Accion adicional" notes={shown.bonusActions} accent={accent} />
                  <Section title="Reaccion" notes={shown.reactions} accent={accent} />
                </div>
              )}

              {shown.features.length > 0 && (
                <Block title="Rasgos">
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {shown.features.map((note) => (
                      <Note key={note.name} note={note} accent={accent} />
                    ))}
                  </div>
                </Block>
              )}

              {shown.feats.length > 0 && (
                <Block title="Tus dotes">
                  <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                    {shown.feats.map(({ name: featName, note }) => (
                      <div key={featName}>
                        <p className={HEADING} style={{ color: accent }}>
                          {note.icon} {featName}
                          <span className="ml-2 font-mono text-[9px] font-normal uppercase tracking-[0.15em] text-bone/30">
                            {CATEGORY_LABEL[note.category] ?? note.category}
                          </span>
                        </p>
                        <p className="mt-1 font-body text-sm leading-relaxed text-bone/50">
                          {note.desc}
                        </p>
                        {note.tip && (
                          <p className="mt-1.5 font-body text-sm italic leading-relaxed text-gold/55">
                            {note.tip}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              {/* Combinations are how a fight is won, so they live on Combate
                  even when a piece of one is a movement feat. */}
              {tab === "combate" && playbook.combos.length > 0 && (
                <Block title={playbook.combos.length === 1 ? "Tu combinacion" : "Tus combinaciones"}>
                  <div className="grid gap-5 md:grid-cols-2">
                    {playbook.combos.map((combo) => (
                      <div
                        key={combo.id}
                        className="border-l-2 bg-void/40 p-4"
                        style={{ borderColor: accent }}
                      >
                        <p className={HEADING} style={{ color: accent }}>
                          {combo.icon} {combo.name}
                        </p>
                        <p className="mt-1.5 font-body text-sm leading-relaxed text-bone/50">
                          {combo.what}
                        </p>
                        <p className="mt-2 font-body text-sm leading-relaxed text-bone/65">
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/30">
                            como se juega{" "}
                          </span>
                          {combo.how}
                        </p>
                      </div>
                    ))}
                  </div>
                </Block>
              )}

              {tab === "combate" && playbook.tips.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {playbook.tips.map((tip) => (
                    <p
                      key={tip}
                      className="border border-ember/30 bg-ember/[0.06] p-4 font-body text-sm leading-relaxed text-bone/65"
                    >
                      {tip}
                    </p>
                  ))}
                </div>
              )}

              {shown.rules.map((block) => (
                <Block key={block.title} title={block.title}>
                  <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {block.items.map((item) => (
                      <div key={item.label}>
                        <dt
                          className="font-mono text-[10px] uppercase tracking-[0.2em]"
                          style={{ color: item.color ?? "#8a857c" }}
                        >
                          {item.label}
                        </dt>
                        <dd className="mt-0.5 font-body text-sm leading-relaxed text-bone/50">
                          {item.desc}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              ))}

              {/* The extras only render on their own tab, so they count
                  towards it being empty — a character whose whole Combate tab
                  is one combination has not got an empty tab. */}
              {isEmpty(shown) &&
                !(tab === "core" && playbook.warnings.length > 0) &&
                !(tab === "combate" && (playbook.combos.length > 0 || playbook.tips.length > 0)) && (
                  <p className="font-body text-sm italic leading-relaxed text-bone/35">
                    Este personaje no tiene nada anotado en esta pestana.
                  </p>
                )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/** Whether a tab would render nothing but its own heading. */
function isEmpty(shown: {
  bonusActions: unknown[];
  reactions: unknown[];
  features: unknown[];
  feats: unknown[];
  rules: unknown[];
}): boolean {
  return (
    shown.bonusActions.length === 0 &&
    shown.reactions.length === 0 &&
    shown.features.length === 0 &&
    shown.feats.length === 0 &&
    shown.rules.length === 0
  );
}

/** A run of play notes, absent entirely when the class has none of that kind. */
function Section({ title, notes, accent }: { title: string; notes: PlayNote[]; accent: string }) {
  if (notes.length === 0) return null;

  return (
    <Block title={title}>
      <div className="space-y-4">
        {notes.map((note) => (
          <Note key={note.name} note={note} accent={accent} />
        ))}
      </div>
    </Block>
  );
}

function Note({ note, accent }: { note: PlayNote; accent: string }) {
  return (
    <div>
      <p
        className={HEADING}
        style={{ color: note.highlight ? accent : "#E6DFCE" }}
      >
        {note.name}
        {note.resource && (
          <span className="ml-2 font-mono text-[9px] font-normal uppercase tracking-[0.15em] text-bone/30">
            {note.resource}
          </span>
        )}
      </p>
      <p className="mt-1 font-body text-sm leading-relaxed text-bone/50">{note.desc}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-gold/50">{title}</p>
      {children}
    </motion.section>
  );
}
