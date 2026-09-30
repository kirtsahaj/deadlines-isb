import { describe, expect, it } from "vitest";
import { isDeadlineInView, sortDeadlineView } from "../deadlineViews";

const NOW = Date.parse("2026-10-01T00:00:00.000Z");
const row = (title: string, due_at: string | null) => ({ title, due_at });

describe("deadline views", () => {
  it("puts the exact now boundary in upcoming for the selected timezone", () => {
    expect(isDeadlineInView(new Date(NOW).toISOString(), "upcoming", NOW, "Asia/Kolkata")).toBe(
      true,
    );
    expect(isDeadlineInView(new Date(NOW).toISOString(), "past", NOW, "Asia/Kolkata")).toBe(false);
  });

  it("classifies the same instant consistently across timezones", () => {
    const due = "2026-09-30T23:59:59.999Z";
    expect(isDeadlineInView(due, "past", NOW, "Asia/Kolkata")).toBe(true);
    expect(isDeadlineInView(due, "past", NOW, "America/New_York")).toBe(true);
  });

  it("sorts future dates ascending and TBD last", () => {
    expect(
      sortDeadlineView(
        [
          row("TBD", null),
          row("Later", "2026-10-03T00:00:00Z"),
          row("Next", "2026-10-02T00:00:00Z"),
        ],
        "upcoming",
      ).map((item) => item.title),
    ).toEqual(["Next", "Later", "TBD"]);
  });

  it("sorts past dates descending", () => {
    expect(
      sortDeadlineView(
        [row("Old", "2026-09-01T00:00:00Z"), row("Recent", "2026-09-30T00:00:00Z")],
        "past",
      ).map((item) => item.title),
    ).toEqual(["Recent", "Old"]);
  });
});
