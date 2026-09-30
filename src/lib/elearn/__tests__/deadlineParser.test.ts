import { describe, expect, it } from "vitest";
import { extractDeadlines, stripApiMarkup } from "../deadlineParser";

const IST_OFFSET_MINUTES = 330;

function istIso(y: number, m: number, d: number, hh: number, mm: number): string {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000).toISOString();
}

describe("stripApiMarkup", () => {
  it("removes tags and decodes entities", () => {
    expect(stripApiMarkup("<p>Due&nbsp;<b>Friday</b></p>")).toContain("Due Friday");
  });
});

describe("extractDeadlines", () => {
  it("reads a day-month-year date with a 24-hour time as IST", () => {
    const [found] = extractDeadlines("Submission deadline: 14/03/2026 23:59");
    expect(found?.iso).toBe(istIso(2026, 3, 14, 23, 59));
    expect(found?.precision).toBe("exact");
  });

  it("reads a written date with a 12-hour time", () => {
    const [found] = extractDeadlines("Assignment due on 5 March 2026 at 6:30 pm");
    expect(found?.iso).toBe(istIso(2026, 3, 5, 18, 30));
  });

  it("assumes end of day when no time is given", () => {
    const [found] = extractDeadlines("Please submit by 5 March 2026");
    expect(found?.iso).toBe(istIso(2026, 3, 5, 23, 59));
    expect(found?.precision).toBe("assumed_end_of_day");
  });

  it("ignores dates with no deadline keyword nearby", () => {
    expect(extractDeadlines("The course started on 5 March 2026.")).toHaveLength(0);
  });

  it("keeps a quote of the sentence it came from", () => {
    const [found] = extractDeadlines("Submit your report by 5 March 2026.");
    expect(found?.evidence).toContain("5 March 2026");
  });

  it("in marker-only mode reads only #deadline# lines", () => {
    const text = "Due 5 March 2026. Also #deadline# 9 April 2026 #deadline#";
    const results = extractDeadlines(text, { markerOnly: true });
    expect(results).toHaveLength(1);
    expect(results[0]?.iso).toBe(istIso(2026, 4, 9, 23, 59));
  });
});
