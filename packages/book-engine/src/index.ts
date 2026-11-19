export type { TextItem, PageText } from "./text-model.js";
export { fold, squash, editDistance } from "./normalize.js";
export { groupLines, groupRows, rowText, type Line } from "./lines.js";
export { splitColumns, pageToText } from "./columns.js";
export { measureNoise, type NoiseStats } from "./noise.js";
export { referenceFromRules, vocabularyFromRules, type RefEntry } from "./reference.js";
export { indexPages, locate, type MatchKind, type Location, type PageIndex } from "./match.js";
export { measureBook, type BookReport, type MeasureOptions } from "./measure.js";
export {
  Dictionary,
  dictionaryFromWords,
  dictionaryFromRules,
  addBookVocabulary,
} from "./dictionary.js";
export { fixSpacing } from "./spacing.js";
export { joinHyphens } from "./hyphens.js";
export { fixOcrToken, fixOcrLine } from "./ocr.js";
export { findRunningKeys, dropRunning } from "./running.js";
export { classifyPage, type PageKind } from "./classify.js";
export {
  cleanBook,
  type CleanBook,
  type CleanPage,
  type CleanOptions,
  type Fixes,
} from "./clean.js";
