/**
 * Reading 5etools' inline markup.
 *
 * Rules text is plain strings with tags in them: "the target is {@condition incapacitated}",
 * "{@damage 8d6} fire damage", "{@b Hit:}". A tag either formats (`b`, `i`), prints something
 * computed (`dc`, `hit`), or names another entry — a condition, a spell, an item. The last kind is
 * the one that matters here: it is what lets a word in a description open its own description.
 *
 * Pure and framework-free, so the shapes can be tested without rendering anything.
 */

import type { RulesKind } from "@/lib/rules-text";

/** Something a link can open. `className`/`level`/`subclass` pin a feature down, which names alone cannot. */
export type RuleRef = {
  kind: RulesKind;
  name: string;
  source?: string;
  extra?: string[];
  className?: string;
  classSource?: string;
  subclass?: string;
  level?: number;
};

export type MarkupNode =
  | { t: "text"; s: string }
  | { t: "fmt"; style: "b" | "i" | "s" | "u" | "note"; children: MarkupNode[] }
  | { t: "link"; ref: RuleRef; label: string }
  | { t: "roll"; s: string };

/** Tags that name an entry, and the kind of entry they name. */
const LINK_KINDS: Record<string, RulesKind> = {
  spell: "spell",
  item: "item",
  condition: "condition",
  disease: "condition",
  status: "condition",
  feat: "feat",
  race: "race",
  background: "background",
  class: "class",
  action: "action",
  sense: "sense",
  skill: "skill",
  variantrule: "variantrule",
  optfeature: "optionalfeature",
  language: "language",
  itemMastery: "mastery",
  itemProperty: "itemProperty",
};

const FORMAT_STYLES: Record<string, "b" | "i" | "s" | "u" | "note"> = {
  b: "b",
  bold: "b",
  i: "i",
  italic: "i",
  s: "s",
  strike: "s",
  u: "u",
  underline: "u",
  note: "note",
};

const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const ATTACKS: Record<string, string> = {
  mw: "Melee Weapon Attack:",
  rw: "Ranged Weapon Attack:",
  "mw,rw": "Melee or Ranged Weapon Attack:",
  "rw,mw": "Melee or Ranged Weapon Attack:",
  ms: "Melee Spell Attack:",
  rs: "Ranged Spell Attack:",
  "ms,rs": "Melee or Ranged Spell Attack:",
  "rs,ms": "Melee or Ranged Spell Attack:",
  m: "Melee Attack:",
  r: "Ranged Attack:",
};

/** Index of the `}` that closes the `{` at `open`, counting nested braces. -1 when unbalanced. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Split on `|` outside nested tags, so `{@b a|b}` inside a display field survives. */
function splitParts(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") depth--;
    else if (body[i] === "|" && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

const signed = (value: string) => {
  const n = Number(value);
  return Number.isNaN(n) ? value : n >= 0 ? `+${n}` : `${n}`;
};

/** Plain text of nodes, for places that cannot hold a link (titles, tooltips). */
export function textOf(nodes: MarkupNode[]): string {
  return nodes
    .map((node) => {
      if (node.t === "text" || node.t === "roll") return node.s;
      if (node.t === "link") return node.label;
      return textOf(node.children);
    })
    .join("");
}

function linkFor(tag: string, parts: string[]): MarkupNode | null {
  const name = (parts[0] ?? "").trim();
  if (!name) return null;

  // `{@class fighter|phb|display|subclass|...}`: a subclass named in the fourth field is its own entry.
  if (tag === "class" && parts[3]) {
    const subclassName = parts[3].trim();
    return {
      t: "link",
      ref: { kind: "subclass", name: subclassName, ...(parts[4] ? { source: parts[4] } : {}), extra: [name] },
      label: textOf(parseMarkup(parts[2] || subclassName)),
    };
  }

  const kind = LINK_KINDS[tag];
  if (!kind) return null;

  const source = parts[1]?.trim();
  return {
    t: "link",
    ref: { kind, name, ...(source ? { source } : {}) },
    label: textOf(parseMarkup(parts[2]?.trim() || name)),
  };
}

function featureLink(tag: string, parts: string[]): MarkupNode | null {
  const name = (parts[0] ?? "").trim();
  if (!name) return null;

  if (tag === "classFeature") {
    // name | class | classSource | level | source | display
    const level = Number(parts[3]);
    return {
      t: "link",
      ref: {
        kind: "classFeature",
        name,
        className: (parts[1] ?? "").trim(),
        classSource: (parts[2] || "PHB").trim(),
        ...(Number.isFinite(level) ? { level } : {}),
        ...(parts[4] ? { source: parts[4].trim() } : {}),
      },
      label: textOf(parseMarkup(parts[5]?.trim() || name)),
    };
  }

  // name | class | classSource | subclassShortName | subclassSource | level | source | display
  const level = Number(parts[5]);
  return {
    t: "link",
    ref: {
      kind: "subclassFeature",
      name,
      className: (parts[1] ?? "").trim(),
      classSource: (parts[2] || "PHB").trim(),
      subclass: (parts[3] ?? "").trim(),
      ...(Number.isFinite(level) ? { level } : {}),
      ...(parts[6] ? { source: parts[6].trim() } : {}),
    },
    label: textOf(parseMarkup(parts[7]?.trim() || name)),
  };
}

function roll(s: string): MarkupNode {
  return { t: "roll", s };
}

/** One tag, as a node. Unknown tags print their display text, which is always the most useful thing. */
function tagNode(tag: string, rest: string): MarkupNode {
  if (tag in FORMAT_STYLES) {
    return { t: "fmt", style: FORMAT_STYLES[tag] as "b", children: parseMarkup(rest) };
  }

  const parts = splitParts(rest);
  const first = parts[0] ?? "";

  if (tag === "classFeature" || tag === "subclassFeature") {
    const node = featureLink(tag, parts);
    if (node) return node;
  }

  if (tag in LINK_KINDS || tag === "class") {
    const node = linkFor(tag, parts);
    if (node) return node;
  }

  switch (tag) {
    case "dice":
    case "damage":
    case "scaledamage":
    case "scaledice":
      // `{@dice 1d6|label}` shows the label; `{@scaledamage 1d6|1-9|2d6}` shows the last.
      return roll(textOf(parseMarkup(tag.startsWith("scale") ? (parts[2] ?? first) : (parts[1] ?? first))));
    case "d20":
    case "hit":
      return roll(signed(first));
    case "dc":
      return { t: "text", s: `DC ${first}` };
    case "chance":
      return { t: "text", s: `${first}%` };
    case "recharge":
      return { t: "text", s: first ? `(Recharge ${first}–6)` : "(Recharge)" };
    case "atk":
      return { t: "fmt", style: "i", children: [{ t: "text", s: ATTACKS[first] ?? `${first} attack:` }] };
    case "h":
      return { t: "fmt", style: "i", children: [{ t: "text", s: "Hit: " }] };
    case "m":
      return { t: "fmt", style: "i", children: [{ t: "text", s: "Miss: " }] };
    case "hitYourSpellAttack":
      return { t: "text", s: "your spell attack modifier" };
    case "actSave":
      return { t: "text", s: `${ABILITY_NAMES[first.toLowerCase()] ?? first} saving throw` };
    case "actSaveFail":
      return { t: "text", s: "On a failed save" };
    case "actSaveSuccess":
      return { t: "text", s: "On a successful save" };
    case "actSaveSuccessOrFail":
      return { t: "text", s: "On a successful or failed save" };
    case "actTrigger":
      return { t: "fmt", style: "i", children: [{ t: "text", s: "Trigger:" }] };
    case "actResponse":
      return { t: "fmt", style: "i", children: [{ t: "text", s: "Response:" }] };
    default:
      return { t: "text", s: textOf(parseMarkup(parts[2] || parts[1] || first)) };
  }
}

/** Parse a string with 5etools tags into nodes. Unbalanced braces print as they are. */
export function parseMarkup(text: string): MarkupNode[] {
  const out: MarkupNode[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ t: "text", s: buffer });
    buffer = "";
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" && text[i + 1] === "@") {
      const end = closeOf(text, i);
      if (end !== -1) {
        const inner = text.slice(i + 2, end);
        const space = inner.search(/\s/);
        const tag = space === -1 ? inner : inner.slice(0, space);
        const rest = space === -1 ? "" : inner.slice(space + 1);
        flush();
        out.push(tagNode(tag, rest));
        i = end;
        continue;
      }
    }
    buffer += text[i];
  }
  flush();
  return out;
}

/** Every reference a string links to, in order. */
export function linksIn(text: string): RuleRef[] {
  const found: RuleRef[] = [];
  const walk = (nodes: MarkupNode[]) => {
    for (const node of nodes) {
      if (node.t === "link") found.push(node.ref);
      else if (node.t === "fmt") walk(node.children);
    }
  };
  walk(parseMarkup(text));
  return found;
}
