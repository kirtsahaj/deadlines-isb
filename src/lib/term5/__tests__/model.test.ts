import { describe, expect, it } from "vitest";
import {
  dueForReminder,
  inView,
  mergeDeadlines,
  sectionHintFromTitle,
  sortView,
  term5CodeFromShortName,
  titlesMatch,
  type MergeInput,
  type OutlineOccurrence,
  type OwnRow,
  type SharedRow,
} from "../model";
import { resolveEnrollments } from "../catalog.server";

const NOW = new Date("2026-10-22T10:00:00+05:30").getTime();

const occ = (o: Partial<OutlineOccurrence>): OutlineOccurrence => ({
  occurrence_id: "X-A01-ALL",
  assessment_id: "X-A01",
  course_code: "CDMA2",
  section_id: null,
  study_group_scope: null,
  title: "Case write-up 1: Crown Equipment",
  date: "2026-10-22",
  time: "23:59",
  due_at: "2026-10-22T23:59:00+05:30",
  date_precision: "datetime",
  deadline_rule: "explicit",
  provisional: false,
  notification_ready: true,
  source_id: "OUTLINE-CDMA2",
  source_pages: "5",
  status: "outline_dated",
  ...o,
});

const own = (o: Partial<OwnRow>): OwnRow => ({
  id: "11111111-1111-4111-a111-111111111111",
  external_key: "assignment:1:2:due",
  title: "Case write-up 1 - Crown Equipment",
  kind: "assignment",
  deadline_type: "due",
  deadline_status: "dated",
  submission_status: "unknown",
  due_at: "2026-10-22T23:59:00+05:30",
  conflict: false,
  moodle_course_id: 900,
  source_primary: "mod_assign_get_assignments",
  ...o,
});

const base = (o: Partial<MergeInput>): MergeInput => ({
  now: NOW,
  enrollments: [{ courseCode: "CDMA2", sectionId: "CDMA2_G", studyGroup: null }],
  courseTitles: { CDMA2: "Corporate Development" },
  outline: [occ({})],
  own: [],
  ownCourses: [{ moodle_course_id: 900, short_name: "CDMA2_PGPMOH_2026-27_T5", full_name: "Corporate Development" }],
  ownLastSuccessAt: null,
  shared: [],
  ...o,
});

describe("course matching uses the complete code", () => {
  it("keeps numeric suffixes distinct for every course", () => {
    expect(term5CodeFromShortName("CDMA2_PGPMOH_2026-27_T5")).toBe("CDMA2");
    expect(term5CodeFromShortName("DTME1_PGPMOH_2026-27_T5")).toBe("DTME1");
    expect(term5CodeFromShortName("NEGA1_PGPMOH_2026-27_T5")).toBe("NEGA1");
  });
  it("rejects other campuses, terms and years", () => {
    expect(term5CodeFromShortName("CDMA_PGPHYD_2026-27_T4")).toBeNull();
    expect(term5CodeFromShortName("CAMS_PGPMOH_2026-27_T4")).toBeNull();
    expect(term5CodeFromShortName("ABTE_PGPMOH_2025-26_T5")).toBeNull();
  });
  it("an outline for CDMA2 never merges into a CDMA1 enrollment", () => {
    const r = mergeDeadlines(base({ enrollments: [{ courseCode: "CDMA1", sectionId: "CDMA1_G", studyGroup: null }] }));
    expect(r).toHaveLength(0);
  });
});

describe("roster enrollment", () => {
  it("matches a verified email privately to roster sections", () => {
    const { enrollments, inRoster } = resolveEnrollments("kirt_singh_pgp2027@isb.edu", []);
    expect(inRoster).toBe(true);
    expect(enrollments.map((e) => e.sectionId).sort()).toEqual(["COBE_I", "MKTS_G", "MSTC_G"]);
  });
  it("applies self-service corrections and ignores unknown sections", () => {
    const { enrollments } = resolveEnrollments("kirt_singh_pgp2027@isb.edu", [
      { course_code: "COBE", section_id: "COBE_G", removed: false },
      { course_code: "MSTC", section_id: null, removed: true },
      { course_code: "ABTE", section_id: "MKTS_H", removed: false },
    ]);
    expect(enrollments.find((e) => e.courseCode === "COBE")?.sectionId).toBe("COBE_G");
    expect(enrollments.some((e) => e.courseCode === "MSTC")).toBe(false);
    expect(enrollments.find((e) => e.courseCode === "ABTE")?.sectionId).toBeNull();
  });
  it("unknown emails are not guessed into any course", () => {
    expect(resolveEnrollments("nobody@isb.edu", []).enrollments).toEqual([]);
  });
});

describe("merging outline and eLearn", () => {
  it("one card per assessment, keeping both sources", () => {
    const r = mergeDeadlines(base({ own: [own({})], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(1);
    expect(r[0]!.sources.map((s) => s.kind)).toEqual(["own_elearn", "outline"]);
    expect(r[0]!.confidence).toBe("own");
    expect(r[0]!.notifyKeys).toHaveLength(2);
  });
  it("surfaces conflicting dates instead of hiding them", () => {
    const r = mergeDeadlines(base({ own: [own({ due_at: "2026-10-23T23:59:00+05:30" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(1);
    expect(r[0]!.conflict).toBe(true);
  });
  it("different assessment numbers stay separate", () => {
    expect(titlesMatch("Case write-up 1", "Case write-up 2")).toBe(false);
    const r = mergeDeadlines(base({ own: [own({ title: "Case write-up 2" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(2);
  });
  it("other-section outline occurrences are excluded", () => {
    const r = mergeDeadlines(base({ outline: [occ({ section_id: "CDMA2_H" })] }));
    expect(r).toHaveLength(0);
  });
  it("stale own data drops to amber", () => {
    const r = mergeDeadlines(base({ own: [own({})], ownLastSuccessAt: "2026-10-21T09:00:00+05:30" }));
    expect(r[0]!.confidence).toBe("outline");
  });
});

const shared = (o: Partial<SharedRow>): SharedRow => ({
  id: "s1",
  course_code: "CDMA2",
  source_key: "assignment:1:2:due",
  contributor_section: "G",
  section_hint: null,
  kind: "assignment",
  deadline_type: "due",
  title: "Case write-up 1 - Crown Equipment",
  due_at: "2026-10-22T23:59:00+05:30",
  last_confirmed_at: "2026-10-22T09:00:00+05:30",
  ...o,
});

describe("shared section updates", () => {
  it("same-section fresh update is teal and merges with outline", () => {
    const r = mergeDeadlines(base({ shared: [shared({})] }));
    expect(r).toHaveLength(1);
    expect(r[0]!.confidence).toBe("shared");
    expect(r[0]!.remindable).toBe(true);
  });
  it("other-section data is a labelled fallback without reminders", () => {
    const r = mergeDeadlines(base({ shared: [shared({ contributor_section: "H" })] }));
    expect(r[0]!.otherSection).toBe(true);
    expect(r[0]!.confidence).toBe("outline");
    expect(r[0]!.remindable).toBe(false);
  });
  it("items explicitly for another section never apply", () => {
    expect(sectionHintFromTitle("Project Group Selection_H")).toBe("H");
    const r = mergeDeadlines(base({ outline: [], shared: [shared({ title: "Group Selection_H", section_hint: "H" })] }));
    expect(r).toHaveLength(0);
  });
  it("own successful sync replaces shared updates", () => {
    const r = mergeDeadlines(base({ outline: [], shared: [shared({})], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(0);
  });
});

describe("ordering and views", () => {
  const item = (dueAt: string | null, submissionStatus = "unknown", dateOnly: string | null = null) => ({ dueAt, dateOnly, submissionStatus, title: dueAt ?? "x" });
  it("undated unsubmitted is Upcoming; undated submitted is Past", () => {
    expect(inView(item(null), "upcoming", NOW)).toBe(true);
    expect(inView(item(null, "submitted"), "past", NOW)).toBe(true);
    expect(inView(item(null, "submitted"), "upcoming", NOW)).toBe(false);
  });
  it("submitted future-dated stays Upcoming", () => {
    expect(inView(item("2026-10-25T10:00:00+05:30", "submitted"), "upcoming", NOW)).toBe(true);
  });
  it("Upcoming nearest first with undated last; Past most recent first", () => {
    const rows = [item(null), item("2026-10-25T10:00:00+05:30"), item("2026-10-23T10:00:00+05:30")];
    expect(sortView(rows, "upcoming").map((r) => r.dueAt)).toEqual(["2026-10-23T10:00:00+05:30", "2026-10-25T10:00:00+05:30", null]);
    const past = [item("2026-10-01T10:00:00+05:30"), item("2026-10-10T10:00:00+05:30")];
    expect(sortView(past, "past")[0]!.dueAt).toBe("2026-10-10T10:00:00+05:30");
  });
  it("date-only items count until the end of that day", () => {
    expect(inView(item(null, "unknown", "2026-10-22"), "upcoming", NOW)).toBe(true);
  });
});

describe("reminders", () => {
  it("only known times within 3 hours, never when submitted or provisional", () => {
    const r = mergeDeadlines(
      base({
        outline: [
          occ({ occurrence_id: "a", due_at: "2026-10-22T12:00:00+05:30" }),
          occ({ occurrence_id: "b", title: "Other thing", due_at: "2026-10-22T12:30:00+05:30", provisional: true, notification_ready: false }),
          occ({ occurrence_id: "c", title: "Date only", date_precision: "date", due_at: null, date: "2026-10-22" }),
          occ({ occurrence_id: "d", title: "Later", due_at: "2026-10-22T14:00:00+05:30" }),
        ],
      }),
    );
    expect(dueForReminder(r, NOW).map((i) => i.outline?.occurrence_id)).toEqual(["a"]);
    const sub = mergeDeadlines(
      base({ own: [own({ due_at: "2026-10-22T12:00:00+05:30", submission_status: "submitted" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30", outline: [] }),
    );
    expect(dueForReminder(sub, NOW)).toHaveLength(0);
  });
});
