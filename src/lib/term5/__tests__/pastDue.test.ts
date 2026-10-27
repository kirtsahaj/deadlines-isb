import { describe, expect, it } from "vitest";
import { showPastDue, type OwnRow } from "../model";

const now = Date.parse("2026-11-01T10:00:00Z");
const past = "2026-10-30T10:00:00Z";
const own = { id: "r1" } as OwnRow;
const item = (p: Partial<Parameters<typeof showPastDue>[0]>) => ({
  dueAt: past,
  dateOnly: null,
  kind: "assignment",
  submissionStatus: "new",
  own,
  ...p,
});

describe("Past due badge", () => {
  it("shows only for the student's own eLearn assignment known not to be submitted", () => {
    expect(showPastDue(item({}), now)).toBe(true);
    expect(showPastDue(item({ submissionStatus: "draft" }), now)).toBe(true);
    expect(showPastDue(item({ submissionStatus: "reopened" }), now)).toBe(true);
  });
  it("never shows when submitted or when the status isn't known", () => {
    expect(showPastDue(item({ submissionStatus: "submitted" }), now)).toBe(false);
    expect(showPastDue(item({ submissionStatus: "unknown" }), now)).toBe(false);
  });
  it("never shows for quizzes, forums, outline, classmate or preread items", () => {
    for (const kind of ["quiz", "forum", "choice", "calendar", "text", "preread", "outline"]) {
      expect(showPastDue(item({ kind }), now)).toBe(false);
    }
    expect(showPastDue(item({ own: undefined }), now)).toBe(false);
    expect(showPastDue(item({ own: undefined, kind: "outline", dueAt: null, dateOnly: "2026-10-20" }), now)).toBe(false);
  });
  it("never shows before the deadline or for undated items", () => {
    expect(showPastDue(item({ dueAt: "2026-11-02T10:00:00Z" }), now)).toBe(false);
    expect(showPastDue(item({ dueAt: null }), now)).toBe(false);
  });
});
