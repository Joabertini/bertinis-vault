/**
 * The way in that comes with the refusal.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SignInButton from "@/components/SignInButton";
import { signInUrl } from "@/lib/account-client";

describe("the sign-in button", () => {
  it("starts the Discord sign-in and comes back to the page it was pressed on", () => {
    const html = renderToStaticMarkup(<SignInButton returnPath="/ritual?c=abc" />);

    expect(html).toContain("Entrar con Discord");
    expect(html).toContain(`href="${signInUrl("/ritual?c=abc").replace(/&/g, "&amp;")}"`);
    expect(html).toContain("%2Fritual%3Fc%3Dabc");
  });

  it("only ever asks to come back to a path of this site", () => {
    const url = signInUrl("/ritual?c=abc");

    // The Worker refuses anything but a path (see `safeReturnPath`); the link must not
    // be the thing that hands it a full address.
    expect(decodeURIComponent(new URL(url).searchParams.get("redirect") ?? "")).toMatch(/^\/(?!\/)/);
  });
});
