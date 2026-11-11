/**
 * The pure part of exporting an actor with its picture.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  COVER_HEIGHT,
  COVER_WIDTH,
  MAX_COVER_CHARS,
  coverCrop,
  exportFileName,
  isCoverDataUrl,
  isOwnPicture,
  pickPortrait,
  withPortrait,
} from "../src/export-portrait.js";

const tiny = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

test("a picture of the actor's own is told from Foundry's stock icons", () => {
  assert.equal(isOwnPicture("assets/Tokens%20PCs/Rathma.jpg"), true);
  assert.equal(isOwnPicture("icons/svg/mystery-man.svg"), false);
  assert.equal(isOwnPicture("systems/dnd5e/icons/svg/actors/character.svg"), false);
  assert.equal(isOwnPicture("assets/clip.webm"), false);
  assert.equal(isOwnPicture(undefined), false);
});

test("the token stands in for a sheet with no portrait of its own", () => {
  assert.equal(
    pickPortrait({ img: "icons/svg/mystery-man.svg", prototypeToken: { texture: { src: "assets/Token.png" } } }),
    "assets/Token.png",
  );
  assert.equal(pickPortrait({ img: "icons/svg/mystery-man.svg" }), null);
});

test("the crop fills the book's 2:3 from the middle", () => {
  const wide = coverCrop(3000, 1000);
  assert.equal(wide.h, 1000);
  assert.ok(Math.abs(wide.w / wide.h - COVER_WIDTH / COVER_HEIGHT) < 1e-9);
  assert.ok(Math.abs(wide.x - (3000 - wide.w) / 2) < 1e-9);
  const tall = coverCrop(1000, 4000);
  assert.equal(tall.w, 1000);
  assert.ok(Math.abs(tall.y - (4000 - tall.h) / 2) < 1e-9);
});

test("only a small image data URL is accepted", () => {
  assert.equal(isCoverDataUrl(tiny), true);
  assert.equal(isCoverDataUrl("https://example.com/a.png"), false);
  assert.equal(isCoverDataUrl(`data:image/webp;base64,${"A".repeat(MAX_COVER_CHARS)}`), false);
});

test("the picture goes in the module's flag and the input is left alone", () => {
  const data = { name: "Rathma", img: "assets/Rathma.jpg", flags: { other: { a: 1 } } };
  const out = withPortrait(data, "bertinis-vault", tiny);
  assert.equal(out.flags["bertinis-vault"].portrait, tiny);
  assert.deepEqual(out.flags.other, { a: 1 });
  assert.equal(out.img, "assets/Rathma.jpg");
  assert.equal(data.flags["bertinis-vault"], undefined);
  assert.equal(withPortrait(data, "bertinis-vault", "nope"), data);
});

test("the file is named like Foundry's own export", () => {
  assert.equal(
    exportFileName({ name: "Rathma Utgard", id: "6SWFbvsJi8MrgXkJ" }),
    "fvtt-Actor-rathma-utgard-6SWFbvsJi8MrgXkJ.json",
  );
  assert.equal(exportFileName({ name: "Ñandú Ç", id: "abc" }), "fvtt-Actor-nandu-c-abc.json");
});
