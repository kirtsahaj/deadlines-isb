import { describe, expect, it } from "vitest";
import hydRoster from "../data/hyderabad-roster.json";
import { campusFor, catalogFor, resolveEnrollments } from "../catalog.server";
import { sharedCourseKey, term5CodeFromShortName } from "../model";
import { classesFor } from "../preparation";

const hydEmail = Object.keys(hydRoster)[0]!;

describe("Hyderabad campus", () => {
  it("imports the final class list counts", () => {
    const rows = Object.values(hydRoster as Record<string, unknown[]>);
    expect(rows.length).toBe(429);
    expect(rows.reduce((n, r) => n + r.length, 0)).toBe(1402);
    expect(catalogFor("HYD").courses).toHaveLength(13);
  });
  it("detects campus from the class list, not the email domain", () => {
    expect(campusFor(hydEmail)).toBe("HYD");
    expect(campusFor("nobody_pgp2027@isb.edu")).toBeNull();
  });
  it("never matches a Mohali eLearn course to a Hyderabad student or vice versa", () => {
    expect(term5CodeFromShortName("NEGA1_PGPMOH_2026-27_T5", "HYD")).toBeNull();
    expect(term5CodeFromShortName("NEGA1_PGPHYD_2026-27_T5", "HYD")).toBe("NEGA1");
    expect(term5CodeFromShortName("NEGA1_PGPHYD_2026-27_T5")).toBeNull();
  });
  it("keeps shared updates separate per campus", () => {
    expect(sharedCourseKey("HYD", "NEGA1")).not.toBe(sharedCourseKey("MOH", "NEGA1"));
  });
  it("rejects corrections to the other campus's courses", () => {
    const r = resolveEnrollments(hydEmail, [{ course_code: "ABTE", section_id: "ABTE_G", removed: false }]);
    expect(r.campus).toBe("HYD");
    expect(r.enrollments.some((e) => e.courseCode === "ABTE")).toBe(false);
  });
  it("does not attach NEGA1 topics to timetable slots while the mapping is unresolved", () => {
    const classes = classesFor(catalogFor("HYD"), [{ courseCode: "NEGA1", sectionId: "NEGA1_A", studyGroup: null }], {});
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every((c) => c.sessionTitle === null && c.prep.length === 0)).toBe(true);
  });
  it("does not enroll anyone into the stray ECSG_B timetable cell", () => {
    expect(catalogFor("HYD").sections.some((s) => s.section_id === "ECSG_B")).toBe(false);
  });
  it("drops the stale 2024 MKSV simulation date", () => {
    expect(catalogFor("HYD").occurrences.some((o) => (o.date ?? "").startsWith("2024"))).toBe(false);
  });
});
