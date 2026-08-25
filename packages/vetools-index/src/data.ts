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
import optionalFeatureRows from "./data/optionalfeature.json" with { type: "json" };
import raceRows from "./data/race.json" with { type: "json" };
import spellRows from "./data/spell.json" with { type: "json" };
import subclassRows from "./data/subclass.json" with { type: "json" };
import subraceRows from "./data/subrace.json" with { type: "json" };

import type {
  BackgroundRow,
  ClassRow,
  FeatRow,
  IndexRow,
  ItemRow,
  OptionalFeatureRow,
  RaceRow,
  SpellRow,
  SubclassRow,
  SubraceRow,
} from "./index.js";

export const spells = spellRows as SpellRow[];
export const items = itemRows as ItemRow[];
export const feats = featRows as FeatRow[];
export const races = raceRows as RaceRow[];
export const backgrounds = backgroundRows as BackgroundRow[];
export const classes = classRows as ClassRow[];
export const subclasses = subclassRows as SubclassRow[];
export const subraces = subraceRows as SubraceRow[];

/**
 * The level-up choices: invocations, metamagic, maneuvers, fighting styles.
 *
 * A class's `optionalFeatureProgression` names the pools it draws from, and a
 * row belongs to a pool by its own `featureType`. That pairing is the whole
 * mechanism, and both halves are read from the data rather than written down.
 */
export const optionalFeatures = optionalFeatureRows as OptionalFeatureRow[];

/**
 * Every collection, keyed by prop.
 *
 * `subclass` used to share the class rows, because the generator only recorded
 * one row per class file. That meant no subclass ever resolved. It has its own
 * 327 rows now.
 */
export const collections: Record<string, IndexRow[]> = {
  spell: spells,
  item: items,
  feat: feats,
  race: races,
  subrace: subraces,
  background: backgrounds,
  class: classes,
  subclass: subclasses,
  optionalfeature: optionalFeatures,
};
