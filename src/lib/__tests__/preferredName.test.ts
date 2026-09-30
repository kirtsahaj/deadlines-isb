import { describe, expect, it } from "vitest";
import { firstPreferredName } from "../preferredName";

describe("firstPreferredName", () => {
  it("prefers Microsoft's verified given name", () => {
    expect(firstPreferredName({ given_name: "Kirt", full_name: "Kirt Singh" }, "Stored Name")).toBe("Kirt");
  });

  it("falls back to a stored profile name", () => {
    expect(firstPreferredName({}, "Aarav Mehta")).toBe("Aarav");
  });

  it("falls back gracefully when names are unavailable", () => {
    expect(firstPreferredName({ preferred_username: "student@isb.edu" }, null)).toBeNull();
  });
});