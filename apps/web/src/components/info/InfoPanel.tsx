/**
 * The floating panel on the left: what something is, in full, from the books.
 *
 * The left of the page was empty. It now holds the text of whatever the player is looking at — the
 * long sword they hover, the background they pick — with every condition, spell and item named in
 * it a link that opens its own entry on top. Back walks the trail; the cross clears it.
 *
 * Wide screens get it as a column in the margin that follows hover. Narrower ones get a sheet at
 * the bottom that opens only on a deliberate choice, since a hover there would cover the page.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import RulesBody, { Block, Inline } from "@/components/info/RulesBody";
import { useInfo } from "@/components/info/info-context";
import { metaLinesFor } from "@/lib/rules-meta";
import type { RuleRef } from "@/lib/rules-markup";
import { resolve, type RulesKind, type RulesRecord } from "@/lib/rules-text";

const KIND_LABEL: Record<RulesKind, string> = {
  spell: "Conjuro",
  item: "Objeto",
  condition: "Condición",
  feat: "Dote",
  background: "Trasfondo",
  race: "Especie",
  class: "Clase",
  subclass: "Subclase",
  classFeature: "Rasgo de clase",
  subclassFeature: "Rasgo de subclase",
  optionalfeature: "Opción",
  action: "Acción",
  variantrule: "Regla",
  skill: "Habilidad",
  sense: "Sentido",
  language: "Idioma",
  mastery: "Maestría",
  itemProperty: "Propiedad",
};

type View =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; record: RulesRecord };

/** The key a ref is told apart by, so the panel reloads when it changes and not otherwise. */
const keyOf = (ref: RuleRef) =>
  [ref.kind, ref.name, ref.source, ref.className, ref.subclass, ref.level, ...(ref.extra ?? [])].join("|");

function useRecord(ref: RuleRef | undefined, edition: "2014" | "2024"): View {
  const [view, setView] = useState<View>({ status: "loading" });
  const key = ref ? keyOf(ref) : "";

  useEffect(() => {
    if (!ref) return;
    let live = true;
    setView({ status: "loading" });
    void resolve(ref, edition).then((record) => {
      if (live) setView(record ? { status: "ready", record } : { status: "missing" });
    });
    return () => {
      live = false;
    };
    // `key` stands for the ref's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, edition]);

  return view;
}

/** A class or subclass is mostly its features, level by level. Each opens to its full text. */
function Features({ record, kind, accent }: { record: RulesRecord; kind: "class" | "subclass"; accent: string }) {
  const { edition } = useInfo();
  const raw = asList(record["classFeatures"] ?? record["subclassFeatures"]);

  const refs = raw
    .map((entry) => (typeof entry === "string" ? entry : typeof entry === "object" && entry && "classFeature" in entry ? String((entry as { classFeature: unknown }).classFeature) : ""))
    .filter(Boolean)
    .map((text) => featureRef(text, kind, record));

  return (
    <div className="mt-6">
      <h4 className="font-mono text-[13px] uppercase tracking-[0.1em]" style={{ color: accent }}>
        Rasgos por nivel
      </h4>
      <div className="mt-2 divide-y divide-iron/40 border-y border-iron/40">
        {refs.map((ref, index) => (
          <FeatureRow key={`${keyOf(ref)}-${index}`} ref_={ref} edition={edition} accent={accent} />
        ))}
      </div>
    </div>
  );
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * "Rage|Barbarian||1" and "Path Feature|Barbarian||Berserker||3", as a ref.
 * The fields are positional, and the book is whichever the class itself comes from when omitted.
 */
function featureRef(text: string, kind: "class" | "subclass", owner: RulesRecord): RuleRef {
  const parts = text.split("|");
  const classSource = parts[2] || (kind === "class" ? owner.source : String(owner["classSource"] ?? "PHB"));
  if (kind === "class") {
    return {
      kind: "classFeature",
      name: parts[0] ?? "",
      className: parts[1] ?? owner.name,
      classSource,
      level: Number(parts[3]),
      source: parts[4] || classSource,
    };
  }
  return {
    kind: "subclassFeature",
    name: parts[0] ?? "",
    className: parts[1] ?? String(owner["className"] ?? ""),
    classSource,
    subclass: parts[3] ?? String(owner["shortName"] ?? ""),
    level: Number(parts[5]),
    source: parts[6] || parts[4] || owner.source,
  };
}

function FeatureRow({ ref_, edition, accent }: { ref_: RuleRef; edition: "2014" | "2024"; accent: string }) {
  const [open, setOpen] = useState(false);
  const view = useRecord(open ? ref_ : undefined, edition);

  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-3 text-left font-body text-[15px] text-white"
      >
        <span>
          <span className="mr-2 font-mono text-[13px]" style={{ color: accent }}>
            {ref_.level}
          </span>
          {ref_.name}
        </span>
        <span className="font-mono text-[13px] text-bone">{open ? "−" : "+"}</span>
      </button>
      {open && view.status === "ready" && (
        <div className="pb-2 pl-6">
          <RulesBody entries={view.record["entries"]} accent={accent} />
        </div>
      )}
      {open && view.status === "missing" && <p className="pb-2 pl-6 text-bone">Sin texto en los libros cargados.</p>}
    </div>
  );
}

function Content({ ref_, accent }: { ref_: RuleRef; accent: string }) {
  const { edition } = useInfo();
  const view = useRecord(ref_, edition);

  if (view.status === "loading") return <p className="mt-4 font-body text-bone">Buscando en los libros…</p>;
  if (view.status === "missing") {
    return (
      <p className="mt-4 font-body text-[15px] text-bone">
        No hay texto de <strong className="text-white">{ref_.name}</strong> en los libros que carga el creador.
      </p>
    );
  }

  const { record } = view;
  const meta = metaLinesFor(ref_.kind, record);
  const higher = asList(record["entriesHigherLevel"]);

  return (
    <>
      {meta.length > 0 && (
        <dl className="mt-3 space-y-1 border-y border-iron/40 py-2 font-body text-[15px]">
          {meta.map((line) => (
            <div key={line.label} className="flex gap-3">
              <dt className="w-32 shrink-0 font-mono text-[13px] uppercase tracking-[0.08em] text-bone">{line.label}</dt>
              <dd className="text-white">
                <Inline text={line.text} accent={accent} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      <RulesBody entries={record["entries"]} accent={accent} />

      {/* Plenty of entries are only a name in the books — a bag of rope, a common language.
          Say so, rather than leave a blank panel that reads as broken. */}
      {asList(record["entries"]).length === 0 &&
        meta.length === 0 &&
        ref_.kind !== "class" &&
        ref_.kind !== "subclass" && (
          <p className="mt-4 font-body text-[15px] text-bone">Los libros no le dedican texto aparte.</p>
        )}

      {higher.length > 0 && (
        <div className="font-body text-[15px] leading-relaxed text-bone">
          {higher.map((entry, index) => (
            <Block key={index} entry={entry as never} depth={0} accent={accent} />
          ))}
        </div>
      )}

      {(ref_.kind === "class" || ref_.kind === "subclass") && (
        <Features record={record} kind={ref_.kind} accent={accent} />
      )}

      <p className="mt-6 font-mono text-[13px] uppercase tracking-[0.1em] text-bone/60">
        {record.source}
        {typeof record["page"] === "number" ? ` · p. ${record["page"]}` : ""}
      </p>
    </>
  );
}

export default function InfoPanel({ accent }: { accent: string }) {
  const { stack, back, close } = useInfo();
  const top = stack[stack.length - 1];

  return (
    <AnimatePresence>
      {top && (
        <motion.aside
          key="info"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.16 }}
          aria-label="Información"
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[45vh] flex-col border bg-[#0B0B0B] min-[1500px]:inset-x-auto min-[1500px]:bottom-6 min-[1500px]:left-5 min-[1500px]:top-24 min-[1500px]:max-h-none min-[1500px]:w-[380px]"
          style={{ borderColor: `${accent}44` }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-iron/50 px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-bone">{KIND_LABEL[top.kind]}</p>
              <h3 className="mt-1 font-display text-xl leading-tight text-white">{top.name}</h3>
            </div>
            <div className="flex shrink-0 gap-2">
              {stack.length > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="border px-2 py-1 font-mono text-[13px] uppercase tracking-[0.08em] text-bone hover:text-white"
                  style={{ borderColor: `${accent}44` }}
                >
                  ‹ Volver
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar información"
                className="border px-2 py-1 font-mono text-[13px] text-bone hover:text-white"
                style={{ borderColor: `${accent}44` }}
              >
                ✕
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <Content key={keyOf(top)} ref_={top} accent={accent} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
