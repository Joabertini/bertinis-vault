import { beforeEach, describe, expect, it } from "vitest";

import { claimShelf } from "@/lib/faro";

const shelf = (id: string) => ({ characters: [{ id, sealedAt: "x", state: {} }] as never, burned: [] });

describe("whose shelf this browser holds", () => {
  beforeEach(() => localStorage.clear());

  it("the first account keeps what was made here", () => {
    expect(claimShelf("ana", shelf("a"))).toBeNull();
    expect(claimShelf("ana", shelf("a"))).toBeNull();
  });

  it("a second account never receives the first one's characters, and the first gets theirs back", () => {
    claimShelf("ana", shelf("a"));
    expect(claimShelf("beto", shelf("a"))).toEqual({ characters: [], burned: [] });
    expect(claimShelf("ana", shelf("b"))).toEqual(shelf("a"));
    expect(claimShelf("beto", shelf("a"))).toEqual(shelf("b"));
  });

  it("an unreadable saved shelf is an empty one", () => {
    claimShelf("ana", shelf("a"));
    localStorage.setItem("faro:estante:beto", "{");
    expect(claimShelf("beto", shelf("a"))).toEqual({ characters: [], burned: [] });
  });
});
