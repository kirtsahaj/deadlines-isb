import { describe, expect, it } from "vitest";
import { resolveTheme, savedPreference } from "../theme";

describe("display preference", () => {
  it("defaults to device default", () => {
    expect(savedPreference(null)).toBe("system");
    expect(savedPreference("junk")).toBe("system");
  });
  it("keeps explicit light/dark", () => {
    expect(savedPreference("dark")).toBe("dark");
    expect(savedPreference("light")).toBe("light");
  });
  it("device default follows the phone", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("explicit choice overrides the phone", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
