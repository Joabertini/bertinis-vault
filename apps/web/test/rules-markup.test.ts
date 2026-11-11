/**
 * 5etools tags: the ones that must become links, and the ones that must read as words.
 */

import { describe, expect, it } from "vitest";

import { linksIn, parseMarkup, textOf } from "@/lib/rules-markup";
import { metaLinesFor } from "@/lib/rules-meta";
import { findIn, resetRulesText, resolve, seedRulesText } from "@/lib/rules-text";

describe("rules markup", () => {
  it("turns a condition into a link to that condition", () => {
    const [link] = linksIn("The target is {@condition incapacitated} until the spell ends.");

    expect(link).toMatchObject({ kind: "condition", name: "incapacitated" });
  });

  it("keeps the book a link names, and shows its display text", () => {
    const nodes = parseMarkup("{@spell Hold Person|XPHB|that spell}");

    expect(nodes[0]).toMatchObject({ t: "link", label: "that spell", ref: { kind: "spell", name: "Hold Person", source: "XPHB" } });
  });

  it("finds links inside bold and inside each other's text", () => {
    const refs = linksIn("{@b Hit: {@damage 2d6} and {@condition prone}}");

    expect(refs.map((ref) => ref.name)).toEqual(["prone"]);
  });

  it("reads dice, DCs and attack bonuses as numbers a player recognises", () => {
    expect(textOf(parseMarkup("{@damage 8d6} fire, {@dc 15}, {@hit 7}, {@chance 25}"))).toBe("8d6 fire, DC 15, +7, 25%");
  });

  it("names the attack a tag stands for", () => {
    expect(textOf(parseMarkup("{@atk mw}"))).toBe("Melee Weapon Attack:");
  });

  it("opens a weapon mastery as its own entry", () => {
    const [link] = linksIn("{@itemMastery Sap|XPHB}");

    expect(link).toMatchObject({ kind: "mastery", name: "Sap", source: "XPHB" });
  });

  it("reads a class tag with a subclass as the subclass", () => {
    const [link] = linksIn("{@class Fighter|PHB|Fighter|Champion|PHB}");

    expect(link).toMatchObject({ kind: "subclass", name: "Champion", extra: ["Fighter"] });
  });

  it("pins a class feature by its class and level", () => {
    const [link] = linksIn("{@classFeature Action Surge|Fighter||2}");

    expect(link).toMatchObject({ kind: "classFeature", name: "Action Surge", className: "Fighter", level: 2 });
  });

  it("prints an unknown tag's display text rather than dropping it", () => {
    expect(textOf(parseMarkup("a {@something thing|x|shown} b"))).toBe("a shown b");
  });

  it("leaves unbalanced braces as they are", () => {
    expect(textOf(parseMarkup("a {@condition prone"))).toBe("a {@condition prone");
  });
});

describe("rules text lookup", () => {
  const table = {
    "incapacitated|phb": { name: "Incapacitated", source: "PHB", entries: ["old"] },
    "incapacitated|xphb": { name: "Incapacitated", source: "XPHB", entries: ["new"] },
    "hold person|phb": { name: "Hold Person", source: "PHB", level: 2, entries: [] },
  };

  it("prefers the book of the character's edition", () => {
    resetRulesText();
    seedRulesText("condition", table);

    expect(findIn("condition", "Incapacitated", undefined, "2024")?.source).toBe("XPHB");
    expect(findIn("condition", "Incapacitated", undefined, "2014")?.source).toBe("PHB");
  });

  it("honours a book that is named", () => {
    resetRulesText();
    seedRulesText("condition", table);

    expect(findIn("condition", "Incapacitated", "PHB", "2024")?.source).toBe("PHB");
  });

  it("matches a subclass by the class it belongs to", () => {
    resetRulesText();
    seedRulesText("subclass", {
      "champion|fighter|phb": { name: "Champion", source: "PHB", className: "Fighter" },
      "champion|other|phb": { name: "Champion", source: "PHB", className: "Other" },
    });

    expect(findIn("subclass", "Champion", "PHB", "2014", ["Fighter"])?.["className"]).toBe("Fighter");
  });

  it("finds a feature by class and level, not by name alone", async () => {
    resetRulesText();
    seedRulesText("classFeature", {
      "second wind|fighter|phb|1|phb": { name: "Second Wind", source: "PHB", className: "Fighter", classSource: "PHB", level: 1 },
      "second wind|other|phb|1|phb": { name: "Second Wind", source: "PHB", className: "Other", classSource: "PHB", level: 1 },
    });

    const record = await resolve({ kind: "classFeature", name: "Second Wind", className: "Fighter", classSource: "PHB", level: 1 }, "2014");

    expect(record?.["className"]).toBe("Fighter");
  });
});

describe("rules meta lines", () => {
  it("spells out a spell's casting facts", () => {
    const lines = metaLinesFor("spell", {
      name: "Hold Person",
      source: "PHB",
      level: 2,
      school: "E",
      time: [{ number: 1, unit: "action" }],
      range: { type: "point", distance: { type: "feet", amount: 60 } },
      components: { v: true, s: true, m: "a small, straight piece of iron" },
      duration: [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }],
    });

    expect(Object.fromEntries(lines.map((line) => [line.label, line.text]))).toMatchObject({
      Nivel: "2nd-level enchantment",
      Lanzamiento: "1 action",
      Alcance: "60 feet",
      Componentes: "V, S, M (a small, straight piece of iron)",
      Duración: "Concentration, up to 1 minute",
    });
  });

  it("links a weapon's mastery", () => {
    const lines = metaLinesFor("item", { name: "Longsword", source: "XPHB", type: "M|XPHB", weaponCategory: "martial", dmg1: "1d8", dmgType: "S", mastery: ["Sap|XPHB"] });

    expect(lines.find((line) => line.label === "Maestría")?.text).toBe("{@itemMastery Sap|XPHB}");
    expect(lines.find((line) => line.label === "Daño")?.text).toBe("1d8 slashing");
  });

  it("links each weapon property to its explanation", () => {
    const lines = metaLinesFor("item", { name: "Longsword", source: "XPHB", type: "M|XPHB", property: ["V|XPHB"] });

    expect(lines.find((line) => line.label === "Propiedades")?.text).toBe("{@itemProperty Versatile|XPHB}");
    expect(linksIn("{@itemProperty Versatile|XPHB}")[0]).toMatchObject({ kind: "itemProperty", name: "Versatile" });
  });
});

describe("rules data completeness", () => {
  it("every subclass in the index has features to show", async () => {
    const { readFileSync } = await import("node:fs");
    const sub = JSON.parse(readFileSync("public/rules/subclass.json", "utf8")) as Record<string, { subclassFeatures?: string[] }>;
    const empty = Object.entries(sub).filter(([, row]) => !row.subclassFeatures?.length).map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it("races and backgrounds reprinted by _copy carry the copied text", async () => {
    const { readFileSync } = await import("node:fs");
    const race = JSON.parse(readFileSync("public/rules/race.json", "utf8")) as Record<string, { entries?: unknown[] }>;
    const background = JSON.parse(readFileSync("public/rules/background.json", "utf8")) as Record<string, { entries?: unknown[] }>;

    expect(race["goblin|erlw"]?.entries?.length).toBeGreaterThan(0);
    expect(Object.values(background).filter((row) => !row.entries?.length)).toEqual([]);
  });
});
