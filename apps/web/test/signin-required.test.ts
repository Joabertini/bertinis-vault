/**
 * What the page does when the store asks for a signed-in account.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { fitCoverImage } from "@/lib/cover-image";
import { publishBuild, sessionCredentials } from "@/lib/vault-client";

afterEach(() => vi.unstubAllGlobals());

describe("the session cookie", () => {
  it("travels only from a page on the site's own domain", () => {
    expect(sessionCredentials("alba.bertinilabs.xyz")).toBe("include");
    expect(sessionCredentials("bertinilabs.xyz")).toBe("include");
    expect(sessionCredentials("localhost")).toBe("same-origin");
    expect(sessionCredentials("evilbertinilabs.xyz")).toBe("same-origin");
    expect(sessionCredentials("bertinilabs.xyz.attacker.example")).toBe("same-origin");
  });
});

describe("when the store answers that sign-in is needed", () => {
  it("tells the player to sign in with Discord instead of blaming the front's credential", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x", code: "signin_required" }), { status: 401 })));
    await expect(publishBuild({} as never)).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/Discord/) });
  });

  it("says the same about a picture", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
    await expect(fitCoverImage(file)).rejects.toThrow(/Discord/);
  });
});
