/**
 * The spells a subclass adds, and when.
 *
 * The headline failure is the Eldritch Knight and the Arcane Trickster: a
 * class's spell list comes off the spell rows, the fighter and the rogue have
 * none, so those two subclasses were offered **no spells at all** — in a
 * builder that let you pick them and set a casting ability. Their list is the
 * wizard's, and the subclass is the only place that says so.
 *
 * The same field carries every domain, circle and oath list, which is why 128
 * of the 203 subclasses have one.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const subclasses = JSON.parse(fs.readFileSync(path.join(DATA, "subclass.json"), "utf8"));

const find = (name, source) =>
  subclasses.find((row) => row.name === name && (!source || row.source === source));

const KINDS = new Set(["expanded", "known", "prepared", "innate"]);

test("the two subclasses whose only spell list is somebody else's have one", () => {
  // Neither the fighter nor the rogue appears on a single spell's class list,
  // so without this both of these cast nothing.
  for (const name of ["Eldritch Knight", "Arcane Trickster"]) {
    const row = find(name, "PHB");
    assert.ok(row.spells.length > 0, name);

    const filters = row.spells.flatMap((entry) => entry.filters.map((f) => f.filter));
    assert.ok(
      filters.every((filter) => /class=Wizard/i.test(filter)),
      `${name} should draw on the wizard list`,
    );
  }
});

test("a domain list is spelled out by name and gated by class level", () => {
  const life = find("Life Domain", "PHB");

  assert.deepEqual(life.spells[0], {
    kind: "prepared",
    variant: null,
    ability: null,
    level: 1,
    spellLevel: null,
    recharge: null,
    uses: null,
    names: [
      { name: "bless", source: null, castLevel: null },
      { name: "cure wounds", source: null, castLevel: null },
    ],
    filters: [],
    choices: [],
  });
  assert.deepEqual(
    life.spells.map((entry) => entry.level),
    [1, 3, 5, 7, 9],
  );
});

test("a warlock patron is gated by spell level, not class level", () => {
  // The data keys these "s1" through "s5". Reading an "s3" as class level 3
  // hands a level 3 warlock third-level spells five levels early.
  const archfey = find("The Archfey", "PHB");

  for (const entry of archfey.spells) {
    assert.equal(entry.level, null, archfey.name);
    assert.ok(entry.spellLevel >= 1 && entry.spellLevel <= 5, archfey.name);
  }
  assert.deepEqual(
    archfey.spells.map((entry) => entry.spellLevel),
    [1, 2, 3, 4, 5],
  );
});

test("an entry gated by neither arrives with the subclass itself", () => {
  // The data writes that level as "_", which is neither a number nor an "sN".
  const ungated = subclasses.filter((row) =>
    row.spells?.some((entry) => entry.level === null && entry.spellLevel === null),
  );

  assert.ok(ungated.length > 0, "some subclass should state no gate");
});

test("the four kinds are four rules and all four appear", () => {
  const kinds = new Set();

  for (const row of subclasses) {
    for (const entry of row.spells ?? []) kinds.add(entry.kind);
  }

  assert.deepEqual([...kinds].sort(), ["expanded", "innate", "known", "prepared"]);
});

test("a filter is kept as a filter rather than expanded into names", () => {
  // Expanding needs the spell list, which is another collection, and baking
  // 300 names into a subclass row would be both large and stale.
  const knight = find("Eldritch Knight", "PHB");
  const first = knight.spells[0];

  assert.deepEqual(first.names, []);
  assert.equal(first.filters.length, 2);
  assert.equal(first.filters[0].count, null, "an `all` filter takes everything");
});

test("a choose-filter carries how many may be chosen", () => {
  const chooser = subclasses.find((row) =>
    row.spells?.some((entry) => entry.filters.some((filter) => filter.count !== null)),
  );

  assert.ok(chooser, "some subclass should offer a bounded choice");
  const filter = chooser.spells
    .flatMap((entry) => entry.filters)
    .find((entry) => entry.count !== null);
  assert.ok(filter.count >= 1);
});

test("a choice from a named shortlist is kept apart from a filter", () => {
  // One subclass states its choice as three spell names rather than as a
  // filter, and it is a different rule: there is nothing to evaluate, only a
  // list to pick from. Treating the object as a filter string crashed on it.
  const scion = find("Scion of the Three", "FRHoF");
  const choice = scion.spells.flatMap((entry) => entry.choices).find(Boolean);

  assert.equal(choice.count, 1);
  assert.deepEqual(
    choice.from.map((ref) => ref.name),
    ["minor illusion", "blade ward", "chill touch"],
  );
});

test("every entry is a shape the rules layer can act on", () => {
  let entries = 0;

  for (const row of subclasses) {
    const where = `${row.name} (${row.source})`;

    for (const entry of row.spells ?? []) {
      entries += 1;
      assert.ok(KINDS.has(entry.kind), `${where}: kind "${entry.kind}"`);
      // Both gates set at once would be two different rules on one entry.
      assert.ok(entry.level === null || entry.spellLevel === null, where);
      assert.ok(
        entry.names.length || entry.filters.length || entry.choices.length,
        `${where}: an empty entry means nothing`,
      );
      for (const ref of entry.names) assert.ok(ref.name.length > 0, where);
      for (const filter of entry.filters) {
        assert.equal(typeof filter.filter, "string", where);
        assert.ok(filter.filter.includes("="), where);
      }
      for (const choice of entry.choices) {
        assert.ok(choice.from.length >= choice.count, where);
      }
    }
  }

  assert.ok(entries > 300, `only ${entries} entries read`);
});

test("a subclass that adds no spells says so with an empty list", () => {
  const champion = find("Champion", "PHB");

  assert.deepEqual(champion.spells, []);
});

test("every filter uses only the four keys the rules layer reads", () => {
  const keys = new Set();

  for (const row of subclasses) {
    for (const entry of row.spells ?? []) {
      for (const { filter } of entry.filters) {
        for (const clause of filter.split("|")) keys.add(clause.split("=")[0]);
      }
    }
  }

  assert.deepEqual([...keys].sort(), ["class", "level", "school", "source"]);
});
