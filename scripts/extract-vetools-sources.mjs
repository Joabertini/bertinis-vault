import fs from "node:fs";

const bundle = fs.readFileSync(process.argv[2], "utf8");

// Only single-line assignments whose value is a string literal, a template
// literal, or another Parser constant. Anything else (object literals such as
// PROP_TO_DISPLAY_NAME) would not survive being spliced out of context.
// Some sub-sources take their date from the parent anthology by indexing
// back into the map, so an indexed lookup has to count as a value too.
const VALUE = String.raw`(?:"[^"]*"|\`[^\`]*\`|Parser\.[A-Za-z0-9_]+(?:\[Parser\.[A-Za-z0-9_]+\])?)`;
const re = new RegExp(
  String.raw`^\s*Parser\.(?:` +
    String.raw`[A-Za-z0-9_]+_(?:NAME|PREFIX)\s*=\s*${VALUE}` +
    String.raw`|SRC_[A-Za-z0-9_]+\s*=\s*${VALUE}` +
    String.raw`|SOURCE_JSON_TO_(?:FULL|ABV|DATE)\[[^\]]+\]\s*=\s*${VALUE}` +
    String.raw`);(?:\s*//[^\n]*)?\s*$`,
  "gm",
);

const lines = bundle.match(re) ?? [];

fs.writeFileSync(
  process.argv[3],
  `const Parser={SOURCE_JSON_TO_FULL:{},SOURCE_JSON_TO_ABV:{},SOURCE_JSON_TO_DATE:{}};
${lines.join("\n")}
export const out = Object.fromEntries(Object.keys(Parser.SOURCE_JSON_TO_FULL).map(k => [k, {
  full: Parser.SOURCE_JSON_TO_FULL[k],
  abv: Parser.SOURCE_JSON_TO_ABV[k] ?? null,
  date: Parser.SOURCE_JSON_TO_DATE[k] ?? null,
}]));`,
);
console.error("lineas:", lines.length);
