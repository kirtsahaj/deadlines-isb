import { describe, expect, it } from "vitest";
import { savedTheme } from "../theme";

describe("day/night preference", () => {
  it("defaults to day mode without a saved choice", () => {
    expect(savedTheme(null)).toBe("light");
    expect(savedTheme("system")).toBe("light");
  });
  it("preserves an explicit night choice", () => {
    expect(savedTheme("dark")).toBe("dark");
    expect(savedTheme("light")).toBe("light");
  });
});