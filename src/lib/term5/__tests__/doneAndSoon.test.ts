import { describe, expect, it } from "vitest";
import { doneKeys, dueSoon, inView, isDone, showPastDue, type OwnRow, type UnifiedDeadline } from "../model";
import { categoryForItem, readAlertSettings } from "../../alerts";

const now = Date.parse("2026-11-01T10:00:00Z");
const H = 3600_000;
const iso = (ms: number) => new Date(now + ms).toISOString();

const base: UnifiedDeadline = {
  id: "row-1",
  notifyKeys: ["row-1"],
  title: "Case write-up",
  courseKey: "T5:MKTS",
  courseCode: "MKTS",
  courseName: "Marketing",
  term: "T5",
  moodleCourseId: 11,
  kind: "assignment",
  deadlineType: "due",
  dueAt: iso(5 * H),
  dateOnly: null,
  submissionStatus: "new",
  confidence: "own",
  sources: [],
  conflict: false,
  provisional: false,
  remindable: true,
  otherSection: false,
  own: { id: "row-1", external_key: "assignment:11:42:due" } as OwnRow,
};

describe("done ticks", () => {
  it("keys own eLearn items by the activity key shared across classmates", () => {
    expect(doneKeys(base)).toEqual(["elearn:assignment:11:42:due"]);
  });

  it("gives a classmate-sourced item the same key, so the tick survives connecting eLearn", () => {
    const shared = { ...base, id: "shared:abc", own: undefined, notifyKeys: ["shared:MKTS:assignment:11:42:due"] };
    expect(doneKeys(shared)).toEqual(["elearn:assignment:11:42:due"]);
    expect(isDone(base, new Set(doneKeys(shared)))).toBe(true);
  });

  it("adds the outline occurrence for merged items, and uses it alone for outline-only items", () => {
    const outline = { occurrence_id: "occ-7" } as UnifiedDeadline["outline"];
    expect(doneKeys({ ...base, outline })).toEqual(["elearn:assignment:11:42:due", "outline:occ-7"]);
    expect(doneKeys({ ...base, id: "outline:occ-7", own: undefined, notifyKeys: ["occ-7"], outline })).toEqual(["outline:occ-7"]);
  });

  it("moves undated done items to Past, but leaves dated ones where they are", () => {
    const undated = { ...base, dueAt: null, done: true };
    expect(inView(undated, "past", now)).toBe(true);
    expect(inView({ ...base, done: true }, "upcoming", now)).toBe(true);
  });

  it("never shows Past due on a done item", () => {
    expect(showPastDue({ ...base, dueAt: iso(-H) }, now)).toBe(true);
    expect(showPastDue({ ...base, dueAt: iso(-H), done: true }, now)).toBe(false);
  });
});

describe("due soon pill", () => {
  it("shows hours inside 24h, minutes inside the last hour, urgent inside 3h", () => {
    expect(dueSoon(iso(5 * H + 20 * 60_000), now)).toEqual({ label: "Due in 5h", urgent: false });
    expect(dueSoon(iso(2 * H), now)).toEqual({ label: "Due in 2h", urgent: true });
    expect(dueSoon(iso(40 * 60_000), now)).toEqual({ label: "Due in 40m", urgent: true });
  });
  it("stays hidden beyond 24h, after the deadline, or without a time", () => {
    expect(dueSoon(iso(25 * H), now)).toBeNull();
    expect(dueSoon(iso(-60_000), now)).toBeNull();
    expect(dueSoon(null, now)).toBeNull();
  });
});

describe("section bells", () => {
  it("defaults every section to on and only an explicit false turns one off", () => {
    expect(readAlertSettings(null)).toEqual({ deadlines: true, classes: true, jobs: true });
    expect(readAlertSettings({ class_reminders: false, job_reminders: true })).toEqual({ deadlines: true, classes: false, jobs: true });
  });
  it("sends prereads to Classes and everything else to Assignments", () => {
    expect(categoryForItem({ kind: "preread" })).toBe("classes");
    expect(categoryForItem({ kind: "assignment" })).toBe("deadlines");
    expect(categoryForItem({ kind: "outline" })).toBe("deadlines");
  });
});
