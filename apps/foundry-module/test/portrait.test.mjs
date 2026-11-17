/**
 * The picture a player gave the character in the builder, as it arrives in the
 * code the module imports.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { payloadIdentitySchema } from "@bertinis-vault/contracts";

import { portraitSource, tokenSource } from "../src/import.js";

const tiny = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

test("the contract carries the portrait in the identity", () => {
  const parsed = payloadIdentitySchema.parse({ characterName: "Rathma", portrait: tiny });
  assert.equal(parsed.portrait, tiny);
});

test("the contract refuses a portrait that is not a small image data URL", () => {
  assert.equal(payloadIdentitySchema.safeParse({ characterName: "R", portrait: "https://x.test/a.png" }).success, false);
  assert.equal(
    payloadIdentitySchema.safeParse({ characterName: "R", portrait: `data:image/webp;base64,${"A".repeat(100_000)}` }).success,
    false,
  );
  assert.equal(payloadIdentitySchema.safeParse({ characterName: "R" }).success, true);
});

test("the module only takes a portrait it can trust", () => {
  assert.equal(portraitSource({ identity: { portrait: tiny } }), tiny);
  assert.equal(portraitSource({ identity: { portrait: "javascript:alert(1)" } }), null);
  assert.equal(portraitSource({ identity: {} }), null);
  assert.equal(portraitSource({}), null);
});

test("the original travels by address, and the token apart from the portrait", () => {
  const original = `https://api.bertinilabs.xyz/images/${"a".repeat(32)}`;
  const token = `https://api.bertinilabs.xyz/images/${"b".repeat(32)}`;
  assert.equal(portraitSource({ identity: { portrait: original } }), original);
  assert.equal(tokenSource({ identity: { portrait: original, token } }), token);
  assert.equal(tokenSource({ identity: { portrait: original } }), null);
  assert.equal(portraitSource({ identity: { portrait: "https://elsewhere.example/x.png" } }), null);
});
