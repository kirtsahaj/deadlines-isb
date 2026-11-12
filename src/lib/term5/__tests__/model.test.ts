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
  it("one card per assessment; the outline is matched quietly and never shown as a source", () => {
    const r = mergeDeadlines(base({ own: [own({})], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(1);
    expect(r[0]!.sources.map((s) => s.kind)).toEqual(["own_elearn"]);
    expect(r[0]!.confidence).toBe("own");
    expect(r[0]!.notifyKeys).toHaveLength(2);
  });
  it("an outline date never raises a conflict warning; eLearn's own conflicts still do", () => {
    const moved = mergeDeadlines(base({ own: [own({ due_at: "2026-10-23T23:59:00+05:30" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(moved).toHaveLength(1);
    expect(moved[0]!.conflict).toBe(false);
    const flagged = mergeDeadlines(base({ own: [own({ conflict: true })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(flagged[0]!.conflict).toBe(true);
  });
  it("different assessment numbers do not attach unrelated outline evidence", () => {
    expect(titlesMatch("Case write-up 1", "Case write-up 2")).toBe(false);
    const r = mergeDeadlines(base({ own: [own({ title: "Case write-up 2" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }));
    expect(r).toHaveLength(1);
    expect(r[0]!.outline).toBeUndefined();
  });
  it("other-section outline occurrences are excluded", () => {
    const r = mergeDeadlines(base({ outline: [occ({ section_id: "CDMA2_H" })] }));
    expect(r).toHaveLength(0);
  });
  it("stale own data is labelled as not refreshed recently, never as the outline", () => {
    const r = mergeDeadlines(base({ own: [own({})], ownLastSuccessAt: "2026-10-21T09:00:00+05:30" }));
    expect(r[0]!.confidence).toBe("own_stale");
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
    expect(r[0]!.confidence).toBe("shared_other");
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
  it("outline-only items never appear or generate reminders, even with an exact time", () => {
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
    expect(r).toEqual([]);
    expect(dueForReminder(r, NOW)).toEqual([]);
    const sub = mergeDeadlines(
      base({ own: [own({ due_at: "2026-10-22T12:00:00+05:30", submission_status: "submitted" })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30", outline: [] }),
    );
    expect(dueForReminder(sub, NOW)).toHaveLength(0);
  });
});

describe("eLearn-only deadline visibility", () => {
  it.each(["MOH", "HYD"] as const)("hides dated, date-only and TBD outline-only assessments on %s", (campus) => {
    expect(mergeDeadlines(base({ campus, outline: [
      occ({}),
      occ({ occurrence_id: "date-only", date_precision: "date", due_at: null }),
      occ({ occurrence_id: "tbd", date_precision: "unknown", due_at: null, date: null, provisional: true }),
    ] }))).toEqual([]);
  });
  it("keeps stale personal and shared eLearn rows, labelled as eLearn", () => {
    const personal = mergeDeadlines(base({ own: [own({})], ownLastSuccessAt: "2026-10-01T09:00:00+05:30" }));
    const pooled = mergeDeadlines(base({ shared: [shared({ last_confirmed_at: "2026-10-01T09:00:00+05:30" })] }));
    expect(personal).toHaveLength(1);
    expect(pooled).toHaveLength(1);
    expect(personal[0]!.sources[0]!.kind).toBe("own_elearn");
    expect(pooled[0]!.sources[0]!.kind).toBe("shared_elearn");
    expect(personal[0]!.confidence).toBe("own_stale");
    expect(pooled[0]!.confidence).toBe("shared_other");
  });
  it("keeps personal and same-section shared reminders; eLearn dates win over the outline silently", () => {
    const due_at = "2026-10-22T12:00:00+05:30";
    for (const input of [
      base({ own: [own({ due_at })], ownLastSuccessAt: "2026-10-22T09:00:00+05:30" }),
      base({ shared: [shared({ due_at })] }),
    ]) {
      const rows = mergeDeadlines(input);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.dueAt).toBe(due_at);
      expect(rows[0]!.conflict).toBe(false);
      expect(dueForReminder(rows, NOW)).toEqual(rows);
    }
  });
  it("does not fill an undated eLearn item with an outline date", () => {
    const rows = mergeDeadlines(base({ own: [own({ due_at: null, deadline_status: "undated" })] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dueAt).toBeNull();
    expect(rows[0]!.dateOnly).toBeNull();
    expect(rows[0]!.outline).toBeDefined();
    expect(dueForReminder(rows, NOW)).toEqual([]);
  });
});
