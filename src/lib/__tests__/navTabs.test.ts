import { describe, expect, it } from "vitest";
import { navTabs } from "../navTabs";

const labels = (t: ReturnType<typeof navTabs>) => t.map((x) => x.label);

describe("navTabs", () => {
  it("roster student gets Placements second and Classes third", () => {
    expect(labels(navTabs({ data: { inRoster: true } }))).toEqual(["Assignments", "Placements", "Classes"]);
  });
  it("off-roster account never gets Classes", () => {
    expect(labels(navTabs({ data: { inRoster: false } }))).toEqual(["Assignments", "Placements"]);
  });
  it("loading or failed roster query shows no tabs instead of a Classes-less bar", () => {
    expect(navTabs({ data: undefined })).toEqual([]);
    expect(navTabs({})).toEqual([]);
  });
});
