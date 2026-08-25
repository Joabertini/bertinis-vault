import test from "node:test";
import assert from "node:assert/strict";

import { isNoise } from "../src/window-watch.js";

test("an application already on screen is not something the import opened", () => {
  // The actor directory redraws when an actor is created. That is the import
  // working, not a window appearing, and it drowned out the real sighting on
  // the first clean run.
  assert.equal(isNoise({ constructor: { name: "ActorDirectory" }, rendered: true }), true);
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
