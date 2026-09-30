import { describe, expect, it } from "vitest";
import {
  courseIdsForTerms,
  OTHER_FILTER_VALUE,
  parseCourseMetadata,
  selectedOrAll,
} from "../courseMetadata";

describe("parseCourseMetadata", () => {
  it.each([
    ["SUET_PGPMOH_2026-27_T4", "SUET", "T4"],
    ["FIN_PGPMOH_2026-27_BW1", "FIN", "BW1"],
    ["  OPS__2026_BW2  ", "OPS", "BW2"],
  ])("parses %s", (value, courseCode, term) => {
    expect(parseCourseMetadata(value)).toEqual({ courseCode, term });
  });

  it.each([null, "", "MALFORMED", "___"])("keeps malformed %s under Other", (value) => {
    expect(parseCourseMetadata(value)).toEqual({
      courseCode: OTHER_FILTER_VALUE,
      term: OTHER_FILTER_VALUE,
    });
  });

  it("selects every available value by default", () => {
    expect([...selectedOrAll(["T1", "T4"], null)]).toEqual(["T1", "T4"]);
  });

  it("narrows course choices to selected terms", () => {
    const courses = [
      { moodle_course_id: 1, short_name: "FIN_2026_T1" },
      { moodle_course_id: 2, short_name: "OPS_2026_T4" },
      { moodle_course_id: 3, short_name: "Malformed" },
    ];
    expect(courseIdsForTerms(courses, new Set(["T4"]))).toEqual(["2"]);
    expect(courseIdsForTerms(courses, new Set([OTHER_FILTER_VALUE]))).toEqual(["3"]);
  });
});
