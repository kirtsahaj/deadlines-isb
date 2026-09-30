import { describe, expect, it } from "vitest";
import { extractDeadlines, stripApiMarkup } from "../deadlineParser";

const IST_OFFSET_MINUTES = 330;

function istIso(y: number, m: number, d: number, hh: number, mm: number): string {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000).toISOString();
}

describe("stripApiMarkup", () => {
  it("removes tags and decodes entities", () => {
    expect(stripApiMarkup("<p>Due&nbsp;<b>Friday</b></p>")).toBe("Due Friday");
  });

  it("drops script contents entirely", () => {
    expect(stripApiMarkup("<script>alert(1)</script>Deadline")).toBe("Deadline");
  });
});

describe("extractDeadlines", () => {
  it("reads a numeric Indian-format date with a 24-hour time as IST", () => {
    const [found] = extractDeadlines("Submission deadline: 14/03/2026 23:59");
    expect(found?.dueIso).toBe(istIso(2026, 3, 14, 23, 59));
    expect(found?.precision).toBe("explicit_24_hour");
  });

  it("reads a written date with a 12-hour time", () => {
    const [found] = extractDeadlines("Assignment due date: 5 March 2026 at 6:30 pm");
    expect(found?.dueIso).toBe(istIso(2026, 3, 5, 18, 30));
    expect(found?.precision).toBe("explicit_12_hour");
  });

  it("reads an ISO date", () => {
    const [found] = extractDeadlines("Deadline 2026-04-09");
    expect(found?.dueIso).toBe(istIso(2026, 4, 9, 23, 59));
  });

  it("assumes end of day when no time is given", () => {
    const [found] = extractDeadlines("Submission by 5 March 2026");
    expect(found?.dueIso).toBe(istIso(2026, 3, 5, 23, 59));
    expect(found?.precision).toBe("assumed_end_of_day");
  });

  it("ignores dates with no deadline keyword nearby", () => {
    expect(extractDeadlines("The course started on 5 March 2026.")).toHaveLength(0);
  });

  it("rejects an impossible date", () => {
    expect(extractDeadlines("Deadline 31/02/2026")).toHaveLength(0);
  });

  it("keeps a quote of the text it came from", () => {
    const [found] = extractDeadlines("Submission of your report: 5 March 2026.");
    expect(found?.text).toContain("5 March 2026");
  });

  it("de-duplicates repeated mentions of the same moment", () => {
    const text = "Deadline 5 March 2026. Submission 5 March 2026.";
    expect(extractDeadlines(text)).toHaveLength(1);
  });

  it("in marker-only mode reads only tagged dates", () => {
    const text = "Due date 5 March 2026. Also #deadline# 9 April 2026 #deadline#";
    const results = extractDeadlines(text, true);
    expect(results).toHaveLength(1);
    expect(results[0]?.dueIso).toBe(istIso(2026, 4, 9, 23, 59));
  });

  it("in marker-only mode returns nothing when no marker is present", () => {
    expect(extractDeadlines("Deadline 5 March 2026", true)).toHaveLength(0);
  });
});
