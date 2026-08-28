/**
 * What the species hands the character, and what it asks them.
 *
 * The index carries it for 77 species and 14 tools; this is the half that
 * decides whether any of it reaches the sheet. A grant is not a checkbox — it
 * is already true — and a choice is a separate budget from the class's and the
 * background's, which is the bug this machinery was built to avoid.
 */

import { describe, expect, it } from "vitest";

import { initialState, type BuilderState } from "@/lib/builder";
import { assignOffers, offersAreSatisfied, proficiencyPlan } from "@/lib/grants";

const draft = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState,
  // The demo draft is a wizard sage, and both of those offer skills of their
  // own — which would count against the species' budget if the offers were
  // read as one list.
  classId: "",
  backgroundId: "",
  subraceId: "",
  extraClasses: [],
  // Which book the species came from. Twenty-five names appear in more than
  // one book legal for the same edition, and without this the 2024 elf
  // resolves to Lorwyn's, which grants nothing.
  sourceBooks: {},
  ...over,
});

describe("what the species grants outright", () => {
  it("hands over a named skill without asking", () => {
    const plan = proficiencyPlan(draft({ raceId: "half-orc" }), "2014");

    expect(plan.grantedSkills).toContain("Intimidation");
    expect(plan.offers).toEqual([]);
  });

  it("hands over a species' skills and its subspecies' together", () => {
    // Added, not replaced: the same rule as traits.
    const plan = proficiencyPlan(draft({ raceId: "elf", subraceId: "wood-elf" }), "2014");

    expect(plan.grantedSkills).toContain("Perception");
  });
});

describe("what the species asks", () => {
  it("offers a bounded choice from its own list", () => {
    const plan = proficiencyPlan(
      draft({ raceId: "elf", sourceBooks: { "race:elf": "XPHB" } }),
      "2024",
    );
    const offer = plan.offers.find((entry) => entry.from === "especie");

    expect(offer).toMatchObject({
      options: ["Insight", "Perception", "Survival"],
      count: 1,
      kind: "skill",
      isOpen: false,
    });
  });

  it("offers the whole skill list where the book says any", () => {
    const plan = proficiencyPlan(
      draft({ raceId: "human", sourceBooks: { "race:human": "XPHB" } }),
      "2024",
    );
    const offer = plan.offers.find((entry) => entry.from === "especie");

    expect(offer?.isOpen).toBe(true);
    expect(offer?.options).toContain("Arcana");
    expect(offer?.count).toBe(1);
  });

  it("keeps a tool choice as a tool choice", () => {
    // The 2014 dwarf picks one of three artisan's tools. Labelled
    // "Competencias" over three tool names, the picker reads as a bug.
    const plan = proficiencyPlan(draft({ raceId: "dwarf" }), "2014");
    const offer = plan.offers.find((entry) => entry.from === "especie");

    expect(offer).toMatchObject({
      options: ["Smith's Tools", "Brewer's Supplies", "Mason's Tools"],
      kind: "tool",
      count: 1,
    });
  });

  it("carries the kind where the data names a kind and not a list", () => {
    const plan = proficiencyPlan(draft({ raceId: "satyr" }), "2014");
    const offer = plan.offers.find((entry) => entry.from === "especie");

    expect(offer?.scope).toBe("instrument");
    expect(offer?.options).toEqual([]);
  });

  it("never holds the player over a question with nothing on screen to answer", () => {
    // An offer with no list can never be assigned a pick, so counting it would
    // lock the chamber shut forever.
    const plan = proficiencyPlan(draft({ raceId: "satyr" }), "2014");

    expect(offersAreSatisfied(plan.offers, [])).toBe(true);
  });
});

describe("budgets stay apart", () => {
  it("does not let the class's picks pay for the species' choice", () => {
    // Read as one flat list, two picks from the wizard filled the elf's quota
    // too and the elf's picker locked before a single choice was made in it.
    const plan = proficiencyPlan(
      draft({ raceId: "elf", classId: "wizard", sourceBooks: { "race:elf": "XPHB" } }),
      "2024",
    );
    const classOffer = plan.offers.findIndex((entry) => entry.from === "clase");
    const speciesOffer = plan.offers.findIndex((entry) => entry.from === "especie");

    expect(classOffer).toBeGreaterThanOrEqual(0);
    expect(speciesOffer).toBeGreaterThanOrEqual(0);

    const assigned = assignOffers(plan.offers, ["Arcana", "History", "Insight"]);

    expect(assigned[speciesOffer]).toEqual(["Insight"]);
    expect(offersAreSatisfied(plan.offers, ["Arcana", "History", "Insight"])).toBe(true);
  });
});

describe("which row of that name", () => {
  it("takes the book the player picked from, not the first of the name", () => {
    /*
     * Four books print an Elf legal in 2024 and the first of them is Lorwyn's,
     * which grants nothing at all. Resolved by name alone, the XPHB elf's
     * choice of Insight, Perception or Survival reached no character — and
     * neither did their traits, their speed or their languages, because every
     * species reader went through the same lookup.
     */
    const named = proficiencyPlan(draft({ raceId: "elf" }), "2024");
    const booked = proficiencyPlan(
      draft({ raceId: "elf", sourceBooks: { "race:elf": "XPHB" } }),
      "2024",
    );

    expect(booked.offers.some((offer) => offer.from === "especie")).toBe(true);
    // Whatever the unnamed one resolves to, naming the book is what makes it
    // the character's own elf.
    expect(booked.offers.length).toBeGreaterThanOrEqual(named.offers.length);
  });

  it("still answers when the draft names no book, as every old build does", () => {
    const plan = proficiencyPlan(draft({ raceId: "half-orc" }), "2014");

    expect(plan.grantedSkills).toContain("Intimidation");
  });
});
