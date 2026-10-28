import { describe, expect, it } from "vitest";
import { classStarting, jobClosing } from "../soon";

// 28 Oct 2026, 16:00 IST
const now = Date.parse("2026-10-28T10:30:00Z");
const H = 3600_000;
const iso = (ms: number) => new Date(now + ms).toISOString();

describe("job closing pill", () => {
  it("counts down within 24h and turns red in the last 3h", () => {
    expect(jobClosing({ deadlineAt: iso(5 * H + 10 * 60_000), deadlineDate: "2026-10-28" }, now)).toEqual({ label: "Closes in 5h", tone: "soon" });
    expect(jobClosing({ deadlineAt: iso(2 * H), deadlineDate: "2026-10-28" }, now)).toEqual({ label: "Closes in 2h", tone: "urgent" });
    expect(jobClosing({ deadlineAt: iso(25 * 60_000), deadlineDate: "2026-10-28" }, now)).toEqual({ label: "Closes in 25m", tone: "urgent" });
  });
  it("stays hidden beyond 24h or once closed", () => {
    expect(jobClosing({ deadlineAt: iso(25 * H), deadlineDate: "2026-10-29" }, now)).toBeNull();
    expect(jobClosing({ deadlineAt: iso(-60_000), deadlineDate: "2026-10-28" }, now)).toBeNull();
  });
  it("says Closes today for a date-only deadline on its last day (IST)", () => {
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-28" }, now)).toEqual({ label: "Closes today", tone: "soon" });
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-29" }, now)).toBeNull();
    // 23:30 IST is still "today" in India even though UTC has the same date
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-28" }, Date.parse("2026-10-28T18:00:00Z"))).not.toBeNull();
    // 00:30 IST next day: no longer today
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-28" }, Date.parse("2026-10-28T19:00:00Z"))).toBeNull();
  });
});

describe("class starting pill", () => {
  const cls = (startIn: number, length = 75 * 60_000) => ({ startsAt: iso(startIn), endsAt: iso(startIn + length) });
  it("is amber within 3h, red in the last 30 min", () => {
    expect(classStarting(cls(2 * H + 30 * 60_000), now)).toEqual({ label: "Starts in 2h", tone: "soon" });
    expect(classStarting(cls(20 * 60_000), now)).toEqual({ label: "Starts in 20m", tone: "urgent" });
  });
  it("says On now while the class runs, and nothing after it ends or beyond 3h", () => {
    expect(classStarting(cls(-10 * 60_000), now)).toEqual({ label: "On now", tone: "now" });
    expect(classStarting(cls(-2 * H), now)).toBeNull();
    expect(classStarting(cls(4 * H), now)).toBeNull();
  });
});
