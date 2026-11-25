import { describe, expect, it } from "vitest";

import type { HojaData } from "@/lib/hoja-2024";
import { portraitUrl, vistaDeHoja } from "@/lib/faro-ficha";

const check = (modifier: number, proficient = false) => ({ modifier, proficient, expert: false });
const ability = (score: number, modifier: number, save = modifier, proficient = false) => ({ score, modifier, save: check(save, proficient) });

const DATA = {
  name: "Aldric",
  classLine: "Fighter 5",
  level: 5,
  species: "Human",
  background: "Soldier",
  alignment: "Neutral Good",
  hitPoints: 44,
  armorClass: 18,
  initiative: 2,
  speed: 30,
  proficiencyBonus: 3,
  abilities: {
    str: ability(16, 3, 6, true), dex: ability(14, 2), con: ability(15, 2, 5, true),
    int: ability(10, 0), wis: ability(12, 1), cha: ability(8, -1),
  },
  skills: { ath: { ...check(6, true), ability: "str" }, prc: { ...check(1), ability: "wis" } },
  tools: [{ label: "Smith's Tools", ability: null, modifier: 3 }],
  classes: [{ classId: "fighter", name: "Fighter", subclass: "Champion", level: 5 }],
  classFeatures: ["Second Wind"],
  speciesTraits: ["Resourceful"],
  backgroundFeatures: [],
  feats: ["Alert"],
  items: [
    { key: "i0", name: "Longsword", quantity: 1, weight: 3, group: "weapon", subtitle: "Martial Melee", equipped: true, attuned: false, attunement: false, attack: { bonus: 6, damage: "1d8+3", damageType: "slashing" } },
    { key: "i1", name: "Chain Mail", quantity: 1, weight: 55, group: "equipment", subtitle: "Heavy Armor", equipped: true, attuned: false, attunement: false, armor: { kind: "HA", ac: 16 } },
    { key: "i2", name: "Rope", quantity: 2, weight: 5, group: "loot", subtitle: "", equipped: false, attuned: false, attunement: false },
  ],
  purse: { pp: 0, gp: 25, ep: 0, sp: 0, cp: 3 },
  characteristics: [{ label: "Age", value: "30" }, { label: "Eyes", value: "" }],
  personality: { trait: "Calm", ideal: "", bond: "Her brother", flaw: "" },
  biography: "<p>Born&nbsp;in a <b>fort</b>.</p>",
  languages: ["Common"],
  weapons: ["Simple", "Martial"],
  armor: ["Light", "Heavy"],
} as unknown as HojaData;

describe("the sheet as Discord's plate reads it", () => {
  const vista = vistaDeHoja(DATA);

  it("keeps the numbers the sheet computed, in the order the plate prints them", () => {
    expect(vista.atributos.map((a) => a.clave)).toEqual(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
    expect(vista.atributos[0]).toEqual({ clave: "STR", valor: 16, mod: 3, salva: 6, competente: true });
    expect([vista.ca, vista.iniciativa, vista.velocidad, vista.competencia]).toEqual([18, 2, "30 ft.", 3]);
    expect(vista.pv).toEqual({ valor: 44, max: 44, temp: 0 });
    expect(vista.percepcion).toBe(11);
  });

  it("names the class and the subclass, and does not invent a system", () => {
    expect(vista.clase).toBe("Fighter 5 · Champion");
    expect(vista.claseNombre).toBe("Fighter");
    expect(vista.sistema).toBe("dnd5e");
  });

  it("splits what is worn from what is carried, and turns weapons into attacks", () => {
    expect(vista.equipado).toEqual([{ nombre: "Longsword", detalle: "Martial Melee" }, { nombre: "Chain Mail", detalle: "AC 16" }]);
    expect(vista.mochila).toEqual([{ nombre: "Rope", cantidad: 2 }]);
    expect(vista.ataques).toEqual([{ nombre: "Longsword", bono: "+6", danio: "1d8+3 slashing", extra: "" }]);
  });

  it("drops empty boxes and markup from the free text", () => {
    expect(vista.apariencia).toEqual([["Age", "30"]]);
    expect(vista.personalidad).toEqual([["Trait", "Calm"], ["Bond", "Her brother"]]);
    expect(vista.biografia).toBe("Born in a fort .");
  });

  it("marks skill ranks and lists every purse coin", () => {
    expect(vista.habilidades.find((s) => s.nombre === "Athletics")?.rango).toBe(1);
    expect(vista.monedas).toEqual([["PP", 0], ["GP", 25], ["EP", 0], ["SP", 0], ["CP", 3]]);
  });

  it("a character without a speed prints a dash, not 'null ft.'", () => {
    expect(vistaDeHoja({ ...DATA, speed: null } as HojaData).velocidad).toBe("—");
  });
});

describe("the portrait the plate may fetch", () => {
  it("is https and short, and nothing else", () => {
    expect(portraitUrl("https://api.bertinilabs.xyz/images/x")).toBe("https://api.bertinilabs.xyz/images/x");
    expect(portraitUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(portraitUrl("http://example.com/x.png")).toBeNull();
    expect(portraitUrl("https://x/" + "a".repeat(500))).toBeNull();
    expect(portraitUrl(undefined)).toBeNull();
  });
});
