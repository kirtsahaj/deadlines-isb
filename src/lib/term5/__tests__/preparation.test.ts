import { describe, expect, it } from "vitest";
import { prereadDeadlines, classesFor, type ScheduleClass } from "../preparation";
import { dueForReminder } from "../model";
import { term5Catalog, courseTitles } from "../catalog.server";

const c = (changes: Partial<ScheduleClass> = {}): ScheduleClass => ({
  id: "MKTS_G-1", courseCode: "MKTS", courseName: "Marketing Strategy", section: "G",
  startsAt: "2026-10-23T14:05:00+05:30", endsAt: "2026-10-23T16:05:00+05:30", room: "LT1",
  sessionTitle: "P&G India", sessionLabels: ["2"], mapping: "chronological_inference_requires_confirmation", sourceKind: null,
  prep: [{ id: "p1", title: "P&G India case", kind: "case", requirement: "assigned", timing: "before_class", alsoFor: [], note: null }], ...changes,
});

describe("preread class reminders", () => {
  it("uses the class start and becomes eligible exactly three hours before", () => {
    const rows = prereadDeadlines([c()], []);
    expect(rows[0]?.dueAt).toBe("2026-10-23T14:05:00+05:30");
    expect(rows[0]?.provisional).toBe(true);
    expect(dueForReminder(rows, Date.parse("2026-10-23T11:04:59+05:30"))).toHaveLength(0);
    expect(dueForReminder(rows, Date.parse("2026-10-23T11:05:00+05:30"))).toHaveLength(1);
    expect(dueForReminder(rows, Date.parse("2026-10-23T14:05:00+05:30"))).toHaveLength(0);
  });
  it("keeps a shared reading only at the earliest applicable class", () => {
    const rows = prereadDeadlines([c({ id: "later", startsAt: "2026-10-25T14:05:00+05:30" }), c()], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("preread:MKTS_G-1");
    expect(rows[0]?.notifyKeys).toEqual(["preread:MKTS:p1"]);
  });
  it("does not turn after-class, in-class tasks or background references into prereads", () => {
    const original = c();
    const p = original.prep[0];
    if (!p) throw new Error("fixture missing");
    for (const timing of ["after_class", "in_class", "context_only"]) expect(prereadDeadlines([c({ prep: [{ ...p, timing }] })], [])).toHaveLength(0);
    expect(prereadDeadlines([c({ prep: [{ ...p, kind: "task" }] })], [])).toHaveLength(0);
  });
  it("never guesses blocked class mappings", () => {
    expect(prereadDeadlines([c({ mapping: "blocked_by_source_conflict" })], [])).toHaveLength(0);
    expect(prereadDeadlines([c({ sessionTitle: null })], [])).toHaveLength(0);
  });
  it("bundles different readings for the same class into one reminder", () => {
    const p = c().prep[0];
    if (!p) throw new Error("fixture missing");
    const rows = prereadDeadlines([c({ prep: [p, { ...p, id: "p2", title: "Second reading" }] })], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.preparation).toHaveLength(2);
    expect(rows[0]?.notifyKeys).toEqual(["preread:MKTS:p1", "preread:MKTS:p2"]);
  });
  it("only projects enrolled sections from the real catalog", () => {
    const classes = classesFor(term5Catalog, [{ courseCode: "MKTS", sectionId: "MKTS_G", studyGroup: null }], courseTitles());
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every(c => c.courseCode === "MKTS" && c.section === "G")).toBe(true);
    expect(prereadDeadlines(classes, []).length).toBeGreaterThan(0);
    expect(classesFor(term5Catalog, [], courseTitles())).toEqual([]);
  });
});