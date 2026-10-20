import { describe, expect, it } from "vitest";
import { createElearnLaunchUrl } from "../elearnLaunch";

describe("simplified eLearn setup", () => {
  it("opens the confirmed Moodle mobile flow on the ISB site", () => {
    const url = new URL(createElearnLaunchUrl());
    expect(url.origin).toBe("https://elearn.isb.edu");
    expect(url.pathname).toBe("/admin/tool/mobile/launch.php");
    expect(url.searchParams.get("confirmed")).toBe("1");
    expect(url.searchParams.get("service")).toBe("moodle_mobile_app");
    expect(url.searchParams.get("urlscheme")).toBe("moodlemobile");
    expect(url.searchParams.get("passport")).toMatch(/^\d+$/);
    expect(createElearnLaunchUrl()).not.toBe(url.toString());
  });
});