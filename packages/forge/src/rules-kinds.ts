/** The kinds of rules entity that have text, and the shape one arrives in. */

export type RulesKind =
  | "spell"
  | "item"
  | "condition"
  | "feat"
  | "background"
  | "race"
  | "class"
  | "subclass"
  | "classFeature"
  | "subclassFeature"
  | "optionalfeature"
  | "action"
  | "variantrule"
  | "skill"
  | "sense"
  | "language"
  | "mastery"
  | "itemProperty";

/** A record as the extractor wrote it. Fields differ by kind, so it is read through helpers. */
export type RulesRecord = Record<string, unknown> & { name: string; source: string };

/** Which edition's wording to prefer when a name exists in several books. */
export type Edition = "2014" | "2024";
