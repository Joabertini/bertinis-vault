/*
 * What the engine reads: one page of positioned text.
 *
 * It is the shape `pdf.js` gives for a page (a run of text with the position
 * of its baseline and its width). The engine never touches the PDF itself, so
 * everything after the ingest can be tested with plain objects.
 */

export interface TextItem {
  /** The text of the run, as the PDF stores it. */
  str: string;
  /** Left edge, in PDF units. */
  x: number;
  /** Baseline, in PDF units. Grows upward, as in PDF. */
  y: number;
  /** Width of the run. */
  w: number;
  /** Height of the run (about the font size). */
  h: number;
}

export interface PageText {
  /** 1-based page number in the file. */
  page: number;
  width: number;
  height: number;
  items: TextItem[];
}
