import { describe, expect, it } from "vitest";
import { hasFreshDeadlineSources, mayRemoveMissing, nextRefreshAt } from "../syncPolicy";

describe("automatic refresh safeguards", () => {
  it("sets the next refresh 30 minutes after the run starts", () => {
    expect(nextRefreshAt(Date.parse("2026-10-20T05:00:00Z"), 30)).toBe("2026-10-20T05:30:00.000Z");
    expect(nextRefreshAt(Date.parse("2026-10-20T05:12:29Z"), 30)).toBe("2026-10-20T05:42:00.000Z");
  });
  it("a failed attempt cannot count as fresh deadline data", () => {
    expect(hasFreshDeadlineSources({ courses: { ok: true }, assignments: { ok: false }, calendar: { ok: false } })).toBe(false);
    expect(hasFreshDeadlineSources({ assignments: { ok: true }, calendar: { ok: false } })).toBe(true);
  });
  it("an incomplete snapshot cannot remove existing deadlines", () => {
    expect(mayRemoveMissing(false)).toBe(false);
    expect(mayRemoveMissing(true)).toBe(true);
  });
});