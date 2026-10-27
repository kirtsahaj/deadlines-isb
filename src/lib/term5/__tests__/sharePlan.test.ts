import { describe, expect, it } from "vitest";
import { planSharedPublish } from "../sharePlan";

const now = "2026-11-01T10:00:00.000Z";
const courses = [
  { id: 11, shortname: "STRI_PGPMOH_2026-27_T5" },
  { id: 12, shortname: "MKSV_PGPMOH_2026-27_T5" },
  { id: 13, shortname: "OLD_PGPMOH_2025-26_T4" },
  { id: 14, shortname: "STRI_PGPHYD_2026-27_T5" },
];
const row = (p: Partial<{ external_key: string; kind: string; moodle_course_id: number; title: string }>) => ({
  external_key: "assignment:11:1:due", kind: "assignment", deadline_type: "due", title: "Case write-up", due_at: now, moodle_course_id: 11, ...p,
});

describe("shared section pool publishing", () => {
  const mine = new Map<string, string | null>([["STRI", "G"], ["MKSV", null]]);

  it("covers only own-campus courses where the contributor's section is known", () => {
    const { scopes } = planSharedPublish([], courses, "MOH", mine, now);
    expect(scopes).toEqual([{ course_code: "STRI", contributor_section: "G" }]);
  });

  it("an empty complete refresh still covers the course, so deleted items can be retired", () => {
    const { payload, scopes } = planSharedPublish([], courses.slice(0, 1), "MOH", mine, now);
    expect(payload).toEqual([]);
    expect(scopes).toHaveLength(1);
  });

  it("publishes only shareable kinds, stamped with this refresh's time", () => {
    const { payload } = planSharedPublish(
      [row({}), row({ external_key: "calendar:11:9:user", kind: "calendar" }), row({ external_key: "assignment:12:2:due", moodle_course_id: 12 })],
      courses,
      "MOH",
      mine,
      now,
    );
    expect(payload.map((p) => p.source_key)).toEqual(["assignment:11:1:due"]);
    expect(payload[0]).toMatchObject({ course_code: "STRI", contributor_section: "G", last_confirmed_at: now, active: true });
  });

  it("keeps campuses apart in the pool key", () => {
    const { scopes } = planSharedPublish([], courses, "HYD", new Map([["STRI", "A"]]), now);
    expect(scopes).toEqual([{ course_code: "HYD.STRI", contributor_section: "A" }]);
  });
});
