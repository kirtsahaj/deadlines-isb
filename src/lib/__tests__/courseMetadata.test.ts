import { describe, expect, it } from "vitest";
import { OTHER_FILTER_VALUE, parseCourseMetadata, selectedOrAll } from "../courseMetadata";

describe("parseCourseMetadata", () => {
  it.each([
    ["SUET_PGPMOH_2026-27_T4", "SUET", "T4"],
    ["FIN_PGPMOH_2026-27_BW1", "FIN", "BW1"],
    ["  OPS__2026_BW2  ", "OPS", "BW2"],
  ])("parses %s", (value, courseCode, term) => {
    expect(parseCourseMetadata(value)).toEqual({ courseCode, term });
  });

  it.each([null, "", "MALFORMED", "___"])("keeps malformed %s under Other", (value) => {
    expect(parseCourseMetadata(value)).toEqual({ courseCode: OTHER_FILTER_VALUE, term: OTHER_FILTER_VALUE });
  });

  it("selects every available value by default", () => {
    expect([...selectedOrAll(["T1", "T4"], null)]).toEqual(["T1", "T4"]);
  });
});