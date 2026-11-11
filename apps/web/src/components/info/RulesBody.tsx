/**
 * Draws 5etools entries: paragraphs, lists, tables, nested sections — with every tagged name a link.
 *
 * An entry is a string, or an object with a `type`. The ones that occur in the books are handled
 * here; anything else that carries `entries` is drawn as a plain section, so an unfamiliar block
 * still shows its text instead of vanishing.
 */

import type { ReactNode } from "react";

import { useInfo } from "@/components/info/info-context";
import { parseMarkup, type MarkupNode } from "@/lib/rules-markup";

type Entry = string | { type?: string; [key: string]: unknown };

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function Nodes({ nodes, accent }: { nodes: MarkupNode[]; accent: string }) {
  const { show } = useInfo();

  return (
    <>
      {nodes.map((node, index) => {
        switch (node.t) {
          case "text":
            return <span key={index}>{node.s}</span>;
          case "roll":
            return (
              <span key={index} className="font-mono text-[14px]" style={{ color: accent }}>
                {node.s}
              </span>
            );
          case "link":
            return (
              <button
                key={index}
                type="button"
                onClick={() => show(node.ref, { push: true })}
                className="cursor-pointer underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid"
                style={{ color: accent }}
                title={node.ref.name}
              >
                {node.label}
              </button>
            );
          case "fmt": {
            const inner = <Nodes nodes={node.children} accent={accent} />;
            if (node.style === "b") return <strong key={index} className="font-semibold text-white">{inner}</strong>;
            if (node.style === "i") return <em key={index}>{inner}</em>;
            if (node.style === "s") return <s key={index}>{inner}</s>;
            if (node.style === "u") return <u key={index}>{inner}</u>;
            return <span key={index} className="italic text-bone/80">{inner}</span>;
          }
        }
      })}
    </>
  );
}

/** A string with tags, inline. */
export function Inline({ text, accent }: { text: string; accent: string }) {
  return <Nodes nodes={parseMarkup(text)} accent={accent} />;
}

function Heading({ name, depth, accent }: { name: string; depth: number; accent: string }) {
  return depth === 0 ? (
    <h4 className="mt-5 font-mono text-[13px] uppercase tracking-[0.1em]" style={{ color: accent }}>
      <Inline text={name} accent={accent} />
    </h4>
  ) : (
    <h5 className="mt-3 font-body text-[15px] font-semibold text-white">
      <Inline text={name} accent={accent} />
    </h5>
  );
}

function Cell({ cell, accent }: { cell: unknown; accent: string }) {
  if (typeof cell === "string" || typeof cell === "number") return <Inline text={String(cell)} accent={accent} />;
  if (cell && typeof cell === "object") {
    const record = cell as { roll?: { exact?: number; min?: number; max?: number }; entry?: Entry };
    if (record.roll) {
      const { exact, min, max } = record.roll;
      return <>{exact !== undefined ? exact : `${min}–${max}`}</>;
    }
    if (record.entry) return <Block entry={record.entry} depth={1} accent={accent} />;
  }
  return null;
}

function Table({ entry, accent }: { entry: Record<string, unknown>; accent: string }) {
  const labels = asArray<string>(entry["colLabels"]);
  const rows = asArray<unknown[]>(entry["rows"]);

  return (
    <div className="my-3 overflow-x-auto">
      {typeof entry["caption"] === "string" && (
        <p className="mb-1 font-mono text-[13px] uppercase tracking-[0.1em] text-bone">{entry["caption"]}</p>
      )}
      <table className="w-full border-collapse text-left font-body text-[14px]">
        {labels.length > 0 && (
          <thead>
            <tr>
              {labels.map((label, index) => (
                <th key={index} className="border-b border-iron/60 px-2 py-1 font-mono text-[13px] font-normal uppercase tracking-[0.08em]" style={{ color: accent }}>
                  <Inline text={label} accent={accent} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-iron/30 align-top">
              {asArray<unknown>(row).map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1">
                  <Cell cell={cell} accent={accent} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Block({ entry, depth, accent }: { entry: Entry; depth: number; accent: string }): ReactNode {
  if (typeof entry === "string") {
    return (
      <p className="mt-2">
        <Inline text={entry} accent={accent} />
      </p>
    );
  }

  const children = asArray<Entry>(entry["entries"] ?? (entry["entry"] !== undefined ? [entry["entry"]] : []));
  const name = typeof entry["name"] === "string" ? entry["name"] : "";

  switch (entry.type) {
    case "list":
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-gold">
          {asArray<Entry>(entry["items"]).map((item, index) => (
            <li key={index}>
              {typeof item === "string" ? (
                <Inline text={item} accent={accent} />
              ) : (
                <ItemRow item={item} accent={accent} />
              )}
            </li>
          ))}
        </ul>
      );
    case "table":
      return <Table entry={entry} accent={accent} />;
    case "item":
      return <ItemRow item={entry} accent={accent} />;
    case "quote":
      return (
        <blockquote className="mt-2 border-l-2 border-iron pl-3 italic">
          {children.map((child, index) => (
            <Block key={index} entry={child} depth={depth + 1} accent={accent} />
          ))}
          {typeof entry["by"] === "string" && <footer className="mt-1 text-[13px] not-italic text-bone">— {entry["by"]}</footer>}
        </blockquote>
      );
    case "hr":
      return <hr className="my-3 border-iron/50" />;
    case "abilityDc":
    case "abilityAttackMod": {
      const attributes = asArray<string>(entry["attributes"]).map((key) => ({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" })[key] ?? key);
      const label = entry.type === "abilityDc" ? "save DC" : "attack modifier";
      const base = entry.type === "abilityDc" ? "8 + " : "";
      return (
        <p className="mt-2 text-center italic">
          <strong className="not-italic text-white">{name || `Spell ${label}`}</strong> = {base}your proficiency bonus + your {attributes.join(" or ")} modifier
        </p>
      );
    }
    case "inset":
    case "insetReadaloud":
      return (
        <div className="mt-3 border-l-2 bg-white/[0.03] px-3 py-2" style={{ borderColor: accent }}>
          {name && <Heading name={name} depth={1} accent={accent} />}
          {children.map((child, index) => (
            <Block key={index} entry={child} depth={depth + 1} accent={accent} />
          ))}
        </div>
      );
    default:
      // entries / section / optfeature / inline / anything with text in it.
      return (
        <div>
          {name && <Heading name={name} depth={depth} accent={accent} />}
          {children.map((child, index) => (
            <Block key={index} entry={child} depth={depth + 1} accent={accent} />
          ))}
        </div>
      );
  }
}

function ItemRow({ item, accent }: { item: Record<string, unknown>; accent: string }) {
  const body = asArray<Entry>(item["entries"] ?? (item["entry"] !== undefined ? [item["entry"]] : []));
  return (
    <>
      {typeof item["name"] === "string" && (
        <strong className="mr-1 font-semibold text-white">
          <Inline text={item["name"]} accent={accent} />
        </strong>
      )}
      {body.map((child, index) =>
        typeof child === "string" ? (
          <Inline key={index} text={child} accent={accent} />
        ) : (
          <Block key={index} entry={child} depth={2} accent={accent} />
        ),
      )}
    </>
  );
}

export default function RulesBody({ entries, accent }: { entries: unknown; accent: string }) {
  const list = asArray<Entry>(entries);
  return (
    <div className="font-body text-[15px] leading-relaxed text-bone">
      {list.map((entry, index) => (
        <Block key={index} entry={entry} depth={0} accent={accent} />
      ))}
    </div>
  );
}
