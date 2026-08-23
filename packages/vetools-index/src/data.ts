/**
 * The index, bundled.
 *
 * Committed rather than fetched: the whole thing is 47KB gzipped, so shipping
 * it makes browsing instant and works offline. Regenerate with
 * `pnpm vetools:index <path-to-5etools-data>`.
 */

import backgroundRows from "./data/background.json" with { type: "json" };
import classRows from "./data/class.json" with { type: "json" };
import featRows from "./data/feat.json" with { type: "json" };
import itemRows from "./data/item.json" with { type: "json" };
import raceRows from "./data/race.json" with { type: "json" };
import spellRows from "./data/spell.json" with { type: "json" };

import type { BackgroundRow, ClassRow, FeatRow, IndexRow, ItemRow, RaceRow, SpellRow } from "./index.js";

export const spells = spellRows as SpellRow[];
export const items = itemRows as ItemRow[];
export const feats = featRows as FeatRow[];
export const races = raceRows as RaceRow[];
export const backgrounds = backgroundRows as BackgroundRow[];
export const classes = classRows as ClassRow[];

/**
 * Every collection, keyed by prop.
 *
 * `subclass` shares the class rows: 5etools keeps subclasses on the classes
 * page, so both resolve against the same list.
 */
export const collections: Record<string, IndexRow[]> = {
  spell: spells,
  item: items,
  feat: feats,
  race: races,
  background: backgrounds,
  class: classes,
  subclass: classes,
};
