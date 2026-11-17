/**
 * The icon pack: every item and spell has one, and the mapping means what it says.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { ICON_SHEET_KEYS, ICON_SILHOUETTES } from "@/lib/icon-atlas";
import {
  isSheetIcon,
  itemHasOwnIcon,
  itemIconKey,
  kindIconKey,
  spellHasOwnIcon,
  spellIconKey,
  type IconItemRow,
  type IconSpellRow,
} from "@/lib/icons";

const items = (version: "2014" | "2024") => forRulesVersion(collections.item ?? [], version) as IconItemRow[];
const spells = (version: "2014" | "2024") => forRulesVersion(collections.spell ?? [], version) as IconSpellRow[];

const exists = (key: string) => isSheetIcon(key as never) || key in ICON_SILHOUETTES;

describe("the pack", () => {
  it("has its sprite sheet and its credits next to the page", () => {
    const dir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../public/icons");
    expect(existsSync(resolve(dir, "atlas.webp"))).toBe(true);
    expect(existsSync(resolve(dir, "CREDITS.txt"))).toBe(true);
  });

  it("never lists the same key twice", () => {
    expect(new Set(ICON_SHEET_KEYS).size).toBe(ICON_SHEET_KEYS.length);
    for (const key of Object.keys(ICON_SILHOUETTES)) expect(ICON_SHEET_KEYS as readonly string[]).not.toContain(key);
  });
});

describe("items", () => {
  const row = (name: string, extra: Partial<IconItemRow> = {}): IconItemRow => ({ name, ...extra });

  it("read by what they are", () => {
    expect(itemIconKey(row("Longsword", { type: "M|XPHB", weaponCategory: "martial" }))).toBe("sword");
    expect(itemIconKey(row("Rapier", { type: "M|XPHB", weaponCategory: "martial" }))).toBe("sword");
    expect(itemIconKey(row("Handaxe", { type: "M|XPHB", weaponCategory: "simple" }))).toBe("axe");
    expect(itemIconKey(row("Light Crossbow", { type: "R|XPHB", weaponCategory: "simple" }))).toBe("crossbow");
    expect(itemIconKey(row("Longbow", { type: "R|XPHB", weaponCategory: "martial" }))).toBe("bow");
    expect(itemIconKey(row("Spear", { type: "M|XPHB", weaponCategory: "simple" }))).toBe("spear");
    expect(itemIconKey(row("Shield", { type: "S|XPHB" }))).toBe("shield");
    expect(itemIconKey(row("Chain Mail", { type: "HA|XPHB" }))).not.toBe("bag");
    expect(itemIconKey(row("Ring of Protection", { type: "RG|DMG", rarity: "rare" }))).toMatch(/^ring/);
    expect(itemIconKey(row("Potion of Healing", { type: "P|DMG", rarity: "common" }))).toMatch(/^potion/);
    expect(itemIconKey(row("Lute", { type: "INS|XPHB" }))).toBe("instrument");
    expect(itemIconKey(row("Riding Horse", { type: "MNT|XPHB" }))).toBe("mount");
  });

  it("show a magic weapon as one", () => {
    expect(itemIconKey(row("Flame Tongue Longsword", { type: "M|DMG", weaponCategory: "martial", rarity: "rare" }))).toBe(
      "magic-sword",
    );
    expect(itemIconKey(row("Dagger of Venom", { type: "M|DMG", weaponCategory: "simple", rarity: "rare" }))).toBe(
      "magic-dagger",
    );
  });

  it("always wear the same variant", () => {
    const first = itemIconKey(row("Potion of Speed", { type: "P|DMG" }));
    expect(itemIconKey(row("Potion of Speed", { type: "P|DMG" }))).toBe(first);
  });

  for (const version of ["2014", "2024"] as const) {
    it(`all have an icon that exists (${version})`, () => {
      const missing = items(version).filter((item) => !exists(itemIconKey(item)));
      expect(missing.map((item) => item.name)).toEqual([]);
    });
  }

  it("mostly get a drawing of their own kind, not the catch-all", () => {
    const all = items("2014").concat(items("2024"));
    const own = all.filter(itemHasOwnIcon).length / all.length;
    // Measured at ~0.6; a drop means a rule stopped matching.
    expect(own).toBeGreaterThan(0.5);
  });
});

describe("spells", () => {
  it("wear their theme, or their school", () => {
    expect(spellIconKey({ name: "Fireball", school: "V" })).toBe("spell-fire");
    expect(spellIconKey({ name: "Cure Wounds", school: "A" })).toBe("spell-heal");
    expect(spellIconKey({ name: "Hold Person", school: "E" })).toBe("spell-enchant");
    expect(spellIconKey({ name: "Gravity Fissure", school: "V" })).toBe("school-evocation");
    expect(spellIconKey({ name: "Reality Break", school: "X" })).toBe("spell-force");
  });

  for (const version of ["2014", "2024"] as const) {
    it(`all have an icon that exists (${version})`, () => {
      const missing = spells(version).filter((spell) => !exists(spellIconKey(spell)));
      expect(missing.map((spell) => spell.name)).toEqual([]);
    });
  }

  it("mostly get a theme of their own", () => {
    const all = spells("2014").concat(spells("2024"));
    expect(all.filter(spellHasOwnIcon).length / all.length).toBeGreaterThan(0.5);
  });
});

describe("rules entries", () => {
  it("get one mark per kind", () => {
    for (const kind of ["feat", "species", "background", "subclass", "feature"] as const) {
      expect(exists(kindIconKey(kind))).toBe(true);
    }
  });
});
