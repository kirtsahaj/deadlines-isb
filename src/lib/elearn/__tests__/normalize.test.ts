import { describe, expect, it } from "vitest";
import { normalizeDeadlines } from "../normalize";

const NOW = Math.floor(Date.UTC(2026, 2, 1) / 1000);
const future = (days: number) => NOW + days * 86400;

const base = {
  assignments: { courses: [] as unknown[] },
  submissions: new Map<number, Record<string, unknown>>(),
  quizzes: { quizzes: [] as unknown[] },
  forums: [] as unknown[],
  calendar: { events: [] as unknown[] },
  contents: new Map<number, Record<string, unknown>[]>(),
  nowSeconds: NOW,
};

describe("normalizeDeadlines", () => {
  it("keeps due and cut-off as separate, stably keyed items", () => {
    const rows = normalizeDeadlines({
      ...base,
      assignments: {
        courses: [
          {
            id: 10,
            assignments: [{ id: 99, name: "Case write-up", duedate: future(3), cutoffdate: future(5) }],
          },
        ],
      },
    });
    expect(rows.map((row) => row.external_key).sort()).toEqual([
      "assignment:10:99:cutoff",
      "assignment:10:99:due",
    ]);
    expect(rows.find((row) => row.deadline_type === "cutoff")?.due_at).toBe(
      new Date(future(5) * 1000).toISOString(),
    );
  });

  it("marks an assignment with no dates as TBD rather than dropping it", () => {
    const rows = normalizeDeadlines({
      ...base,
      assignments: { courses: [{ id: 10, assignments: [{ id: 1, name: "Group project" }] }] },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deadline_status).toBe("TBD");
    expect(rows[0]?.due_at).toBeNull();
  });

  it("prefers a granted extension over the published due date", () => {
    const rows = normalizeDeadlines({
      ...base,
      assignments: {
        courses: [{ id: 10, assignments: [{ id: 7, name: "Essay", duedate: future(2) }] }],
      },
      submissions: new Map([
        [
          7,
          {
            lastattempt: {
              extensionduedate: future(6),
              submission: { status: "submitted" },
            },
          },
        ],
      ]),
    });
    expect(rows[0]?.due_at).toBe(new Date(future(6) * 1000).toISOString());
    expect(rows[0]?.submission_status).toBe("submitted");
  });

  it("drops items that ended more than 30 days ago", () => {
    const rows = normalizeDeadlines({
      ...base,
      quizzes: { quizzes: [{ id: 3, course: 10, name: "Old quiz", timeclose: NOW - 40 * 86400 }] },
    });
    expect(rows).toHaveLength(0);
  });

  it("does not duplicate a calendar event that matches an activity", () => {
    const due = future(4);
    const rows = normalizeDeadlines({
      ...base,
      assignments: {
        courses: [{ id: 10, assignments: [{ id: 42, name: "Memo", duedate: due }] }],
      },
      calendar: {
        events: [
          { id: 500, courseid: 10, instance: 42, modulename: "assign", name: "Memo", timestart: due },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source_evidence.length).toBeGreaterThan(1);
  });

  it("flags a conflict when the calendar disagrees with the activity", () => {
    const rows = normalizeDeadlines({
      ...base,
      assignments: {
        courses: [{ id: 10, assignments: [{ id: 42, name: "Memo", duedate: future(4) }] }],
      },
      calendar: {
        events: [
          {
            id: 500,
            courseid: 10,
            instance: 42,
            modulename: "assign",
            name: "Memo",
            timestart: future(5),
          },
        ],
      },
    });
    expect(rows.some((row) => row.conflict)).toBe(true);
  });

  it("labels a date found in course text as lower-confidence evidence", () => {
    const rows = normalizeDeadlines({
      ...base,
      contents: new Map([
        [
          10,
          [{ id: 1, name: "Week 1", summary: "<p>Submission deadline: 20 March 2026</p>" }],
        ],
      ]),
    });
    const textRow = rows.find((row) => row.kind === "text");
    expect(textRow).toBeDefined();
    expect(textRow?.deadline_status).toBe("dated_from_text");
    expect(textRow?.text_evidence).toContain("20 March 2026");
  });
});
