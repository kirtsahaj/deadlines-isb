import { describe, expect, it } from "vitest";
import { classStarting, deadlinePill, jobClosing } from "../soon";

// 28 Oct 2026, 16:00 IST
const now = Date.parse("2026-10-28T10:30:00Z");
const H = 3600_000;
const iso = (ms: number) => new Date(now + ms).toISOString();

describe("deadline pill (Assignments and timed jobs)", () => {
  it("counts down within 24h: amber above 12h, red inside 12h", () => {
    expect(deadlinePill("Closes", iso(17 * H), now)).toEqual({ label: "Closes in 17h", tone: "soon" });
    expect(deadlinePill("Closes", iso(12 * H), now)).toEqual({ label: "Closes in 12h", tone: "urgent" });
    expect(deadlinePill("Due", iso(25 * 60_000), now)).toEqual({ label: "Due in 25m", tone: "urgent" });
  });
  it("says tomorrow only when it is more than 24h away and dated tomorrow in India", () => {
    // Thu 29 Oct, 23:00 IST = 31h away
    expect(deadlinePill("Due", "2026-10-29T17:30:00Z", now)).toEqual({ label: "Due tomorrow", tone: "soon" });
    // 22:00 IST Wednesday → Friday 09:00 IST is 35h away but not tomorrow
    const lateWed = Date.parse("2026-10-28T16:30:00Z");
    expect(deadlinePill("Due", "2026-10-30T03:30:00Z", lateWed)).toBeNull();
    // ...while Thursday 23:00 IST from late Wednesday is 25h away and is tomorrow
    expect(deadlinePill("Due", "2026-10-29T17:30:00Z", lateWed)).toEqual({ label: "Due tomorrow", tone: "soon" });
  });
  it("stays hidden once passed or without a time", () => {
    expect(deadlinePill("Due", iso(-60_000), now)).toBeNull();
    expect(deadlinePill("Due", null, now)).toBeNull();
  });
});

describe("job closing pill", () => {
  it("uses the deadline pill when the time is known", () => {
    expect(jobClosing({ deadlineAt: iso(17 * H), deadlineDate: "2026-10-29" }, now)).toEqual({ label: "Closes in 17h", tone: "soon" });
  });
  it("date-only: Closes today (red) on the day, Closes tomorrow (amber) the day before (IST)", () => {
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-28" }, now)).toEqual({ label: "Closes today", tone: "urgent" });
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-29" }, now)).toEqual({ label: "Closes tomorrow", tone: "soon" });
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-30" }, now)).toBeNull();
    // 00:30 IST on the 29th: the 28th has passed, the 29th is today
    const past = Date.parse("2026-10-28T19:00:00Z");
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-28" }, past)).toBeNull();
    expect(jobClosing({ deadlineAt: null, deadlineDate: "2026-10-29" }, past)).toEqual({ label: "Closes today", tone: "urgent" });
  });
});

describe("class starting pill", () => {
  const cls = (startIn: number, length = 75 * 60_000) => ({ startsAt: iso(startIn), endsAt: iso(startIn + length) });
  it("is amber within 6h, red in the last 30 min", () => {
    expect(classStarting(cls(5 * H + 30 * 60_000), now)).toEqual({ label: "Starts in 5h", tone: "soon" });
    expect(classStarting(cls(20 * 60_000), now)).toEqual({ label: "Starts in 20m", tone: "urgent" });
  });
  it("says On now while the class runs, and nothing after it ends or beyond 6h", () => {
    expect(classStarting(cls(-10 * 60_000), now)).toEqual({ label: "On now", tone: "now" });
    expect(classStarting(cls(-2 * H), now)).toBeNull();
    expect(classStarting(cls(7 * H), now)).toBeNull();
  });
});
