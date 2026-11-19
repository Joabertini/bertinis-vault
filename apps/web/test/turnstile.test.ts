/**
 * The page's side of Turnstile: no token when it is off, a token on the write when it is on, and a
 * refusal that says what to do about it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { fitCoverImage } from "@/lib/cover-image";
import { turnstileEnabled, turnstileHeaders, turnstileToken } from "@/lib/turnstile";
import { publishBuild } from "@/lib/vault-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete (window as { turnstile?: unknown }).turnstile;
});

describe("with no site key", () => {
  it("is off and sends nothing", async () => {
    expect(turnstileEnabled()).toBe(false);
    expect(await turnstileToken()).toBeNull();
    expect(await turnstileHeaders()).toEqual({});
  });
});

describe("with a site key", () => {
  it("puts the token Turnstile hands back on the write", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITEKEY", "0xSITE");
    const rendered: Record<string, unknown>[] = [];
    (window as { turnstile?: unknown }).turnstile = {
      render: (_box: HTMLElement, options: Record<string, unknown>) => {
        rendered.push(options);
        return "w1";
      },
      execute: () => (rendered[0]!.callback as (t: string) => void)("tok-123"),
      remove: vi.fn(),
    };

    expect(await turnstileHeaders()).toEqual({ "X-Turnstile-Token": "tok-123" });
    expect(rendered[0]).toMatchObject({ sitekey: "0xSITE", appearance: "interaction-only" });
    // The box it made for a possible challenge is gone afterwards.
    expect(document.body.querySelectorAll("div[style*='fixed']")).toHaveLength(0);
  });

  it("is null, not an error, when Turnstile reports a failure", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITEKEY", "0xSITE");
    const rendered: Record<string, unknown>[] = [];
    (window as { turnstile?: unknown }).turnstile = {
      render: (_box: HTMLElement, options: Record<string, unknown>) => {
        rendered.push(options);
        return "w1";
      },
      execute: () => (rendered[0]!["error-callback"] as () => void)(),
      remove: vi.fn(),
    };

    expect(await turnstileToken()).toBeNull();
  });
});

describe("when the store says Turnstile did not vouch for the write", () => {
  const refusal = (code: string) =>
    vi.fn(async () => new Response(JSON.stringify({ error: "x", code }), { status: 403 }));

  it("tells the player to reload, for a build", async () => {
    for (const code of ["turnstile_required", "turnstile_failed"]) {
      vi.stubGlobal("fetch", refusal(code));
      await expect(publishBuild({} as never)).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/Recargá/),
      });
    }
  });

  it("says the same for a picture", async () => {
    vi.stubGlobal("fetch", refusal("turnstile_failed"));
    const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
    await expect(fitCoverImage(file)).rejects.toThrow(/Recargá/);
  });

  it("leaves every other 403 with its own message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    await expect(publishBuild({} as never)).rejects.toMatchObject({
      message: expect.stringMatching(/credencial/),
    });
  });
});
