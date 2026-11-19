export type { TextItem, PageText } from "./text-model.js";
export { fold, squash, editDistance } from "./normalize.js";
export { groupLines, type Line } from "./lines.js";
export { splitColumns, pageToText } from "./columns.js";
export { measureNoise, type NoiseStats } from "./noise.js";
export { referenceFromRules, vocabularyFromRules, type RefEntry } from "./reference.js";
export { indexPages, locate, type MatchKind, type Location, type PageIndex } from "./match.js";
export { measureBook, type BookReport, type MeasureOptions } from "./measure.js";
