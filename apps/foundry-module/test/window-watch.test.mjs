import test from "node:test";
import assert from "node:assert/strict";

import { isNoise } from "../src/window-watch.js";

test("an application already on screen is not something the import opened", () => {
  // The actor directory redraws when an actor is created. That is the import
  // working, not a window appearing, and it drowned out the real sighting on
  // the first clean run.
  assert.equal(isNoise({ constructor: { name: "ActorDirectory" }, rendered: true }), true);
});

test("a sidebar tab redrawing while hidden is not a window", () => {
  // The actors tab redraws on actor creation even when the chat tab is the one
  // showing; it is not rendered then, and it warned on every import.
  class ActorDirectory {
    static tabName = "actors";
    rendered = false;
  }
  assert.equal(isNoise(new ActorDirectory()), true);
});

test("an application opening for the first time is reported", () => {
  assert.equal(isNoise({ constructor: { name: "Charactermancer_Class" }, rendered: false }), false);
  assert.equal(isNoise({ constructor: { name: "DialogV2" } }), false);
});

test("an application that throws on inspection is reported rather than swallowed", () => {
  const hostile = {
    get rendered() {
      throw new Error("not constructed yet");
    },
  };

  assert.equal(isNoise(hostile), false);
});
