/**
 * Fills the roll20 sheet the way roll20 fills it.
 *
 * The vendored sheet is a form, not a document: every number on it lives in an
 * `<input name="attr_x">` or a `<span name="attr_x">` that roll20 populates
 * from the character, every label is an empty element with a `data-i18n` key,
 * and every list — skills, weapons, equipment, spells — is a
 * `<fieldset class="repeating_x">` that roll20 clones once per row.
 *
 * This does those three things and nothing else. It does not lay anything out,
 * choose a colour or name a field: the arrangement is the sheet's, and the only
 * thing this file decides is which of our numbers goes in which of its boxes.
 * That mapping lives in `shaped-attrs.ts`, apart from the mechanics, so it can
 * be corrected without touching how the filling works.
 *
 * Kept out of the component and free of React so it can be tested against the
 * real vendored HTML in jsdom, which is the only way to know a name still hits
 * something. A misspelt attribute silently fills nothing.
 */

/** A value as the sheet stores it. Booleans are roll20's `"1"` / `"0"`. */
export type ShapedValue = string | number;

export type ShapedRow = Record<string, ShapedValue>;

export type ShapedData = {
  /** Keyed by the full attribute name, `attr_` included. */
  attrs: Record<string, ShapedValue>;
  /** Keyed by the fieldset's class: `repeating_skill`, `repeating_offense`. */
  rows: Record<string, ShapedRow[]>;
};

/**
 * Writes one value where roll20 would write it.
 *
 * The `value` **attribute** matters as much as the property: the stylesheet
 * reads it directly — `input.sheet-toggle-edit-mode[value='1'] ~ div
 * .sheet-presentation` is how the sheet switches between its display and its
 * edit face — and an attribute selector never sees a property assignment.
 */
function writeValue(element: Element, value: ShapedValue): void {
  const text = String(value);

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      element.checked = element.value === text;
      return;
    }
    element.value = text;
    element.setAttribute("value", text);
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = text;
    element.textContent = text;
    return;
  }

  if (element instanceof HTMLSelectElement) {
    element.value = text;
    return;
  }

  // `<span name="attr_x">` is roll20's read-only display, and most of what a
  // player actually reads on this sheet is one of these.
  element.textContent = text;
}

/** Every element bound to an attribute, optionally skipping expanded rows. */
function boundElements(root: ParentNode, insideRows: boolean): Element[] {
  const all = [...root.querySelectorAll("[name^='attr_']")];
  return insideRows ? all : all.filter((element) => !element.closest(".repitem"));
}

export function applyAttrs(root: ParentNode, attrs: Record<string, ShapedValue>): void {
  for (const element of boundElements(root, true)) {
    const name = element.getAttribute("name");
    if (!name) continue;

    const value = attrs[name];
    if (value !== undefined) writeValue(element, value);
  }
}

/**
 * Turns each `<fieldset class="repeating_x">` into the rows it stands for.
 *
 * Roll20 wraps them in `.repcontainer > .repitem`, unprefixed, and the
 * stylesheet targets those names — 85 rules mention `repcontainer` — so the
 * wrappers are built with exactly those class names. A fieldset with no rows is
 * removed rather than left empty: an empty fieldset still draws its box, and a
 * character with no weapons would show a weapon table with a header and
 * nothing under it.
 */
export function expandRepeating(root: ParentNode, rows: Record<string, ShapedRow[]>): void {
  const fieldsets = [...root.querySelectorAll("fieldset[class^='repeating_']")];

  for (const fieldset of fieldsets) {
    const name = fieldset.getAttribute("class") ?? "";
    const entries = rows[name] ?? [];
    const owner = fieldset.ownerDocument;

    const container = owner.createElement("div");
    container.className = "repcontainer";

    for (const entry of entries) {
      const item = owner.createElement("div");
      item.className = "repitem";
      item.innerHTML = fieldset.innerHTML;
      applyAttrs(item, entry);
      container.appendChild(item);
    }

    fieldset.replaceWith(container);
  }
}

/**
 * Writes the labels roll20's i18n writes.
 *
 * The elements come empty — `<span data-i18n="STRENGTH"></span>` — so without
 * this pass the sheet renders with every heading blank. A key with no entry
 * keeps its own name, which reads as a bug in the map instead of an absence.
 */
export function applyLabels(root: ParentNode, labels: Record<string, string>): void {
  // `||`, not `??`: a key present with an empty translation is a hole in the
  // language file, and an empty heading reads as a bug in the sheet.
  const text = (key: string) => labels[key] || key;

  for (const element of root.querySelectorAll("[data-i18n]")) {
    const key = element.getAttribute("data-i18n");
    if (key) element.textContent = text(key);
  }

  for (const attribute of ["title", "placeholder", "aria-label", "alt"]) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      if (key) element.setAttribute(attribute, text(key));
    }
  }
}

/**
 * The whole pass, in the order the steps depend on each other.
 *
 * Rows first: their contents are clones made here, so labels and values have to
 * be written after they exist or the clones come out blank.
 */
export function renderShaped(
  root: ParentNode,
  data: ShapedData,
  labels: Record<string, string>,
): void {
  expandRepeating(root, data.rows);
  applyLabels(root, labels);

  // Row values were written when the row was cloned; a global attribute must
  // not reach inside and overwrite them. `attr_name` is on the character and on
  // every weapon, and without this the last weapon would be called Kaelen.
  for (const element of boundElements(root, false)) {
    const name = element.getAttribute("name");
    if (!name) continue;

    const value = data.attrs[name];
    if (value !== undefined) writeValue(element, value);
  }
}
