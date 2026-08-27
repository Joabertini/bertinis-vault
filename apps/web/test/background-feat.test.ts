import { describe, expect, test } from "vitest";

import { collections, forRulesVersion } from "@bertinis-vault/vetools-index";
import { featChoiceForBackground, slugOf } from "../src/lib/index-options";

const backgrounds = (rulesVersion: "2014" | "2024") =>
  forRulesVersion(collections.background ?? [], rulesVersion) as { name: string }[];

describe("the feat a background hands over", () => {
  test("2024 grants one from all but one of its backgrounds", () => {
    // The origin feat is the edition's own idea, and it is not optional: a
    // 2024 character without one is missing a mechanic, not a flourish.
    const all = backgrounds("2024");
    const granting = all.filter((row) => featChoiceForBackground(slugOf(row.name), "2024"));

    expect(all.length).toBe(60);
    expect(granting.length).toBe(59);
  });

  test("2014 grants one from a handful, so the field is not edition-specific", () => {
    const granting = backgrounds("2014").filter((row) =>
      featChoiceForBackground(slugOf(row.name), "2014"),
    );

    expect(granting.length).toBe(15);
  });

  test("a single option is a grant, several are a question", () => {
    // The Forge records the first without asking and leaves the second to the
    // player. Both shapes exist in the data, so both paths are reachable.
    const shapes = backgrounds("2024")
      .map((row) => featChoiceForBackground(slugOf(row.name), "2024")?.options.length ?? 0)
      .filter((count) => count > 0);

    expect(shapes.some((count) => count === 1)).toBe(true);
    expect(Math.min(...shapes)).toBeGreaterThan(0);
  });

  test("the granted feat resolves to a feat the index knows", () => {
    // `slugOf(option.name)` is what the draft stores, and it has to match a
    // real feat or the character exports a reference to nothing.
    const featIds = new Set(
      (forRulesVersion(collections.feat ?? [], "2024") as { name: string }[]).map((row) =>
        slugOf(row.name),
      ),
    );

    const unresolved = backgrounds("2024").flatMap((row) => {
      const choice = featChoiceForBackground(slugOf(row.name), "2024");
      return (choice?.options ?? [])
        .map((option) => slugOf(option.name))
        .filter((id) => !featIds.has(id))
        .map((id) => `${row.name} -> ${id}`);
    });

    expect(unresolved).toEqual([]);
  });
});
