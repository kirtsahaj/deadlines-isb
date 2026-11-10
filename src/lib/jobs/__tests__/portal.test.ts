import { describe, expect, it } from "vitest";
import { changeSummary, isPpoPpi, parsePortalRows, planPortalSync, portalSlot, tidy, type AppJob, type PortalJob } from "../portal";

const now = Date.parse("2026-11-11T21:00:00+05:30");
const pj = (portalId: string, company: string, role: string, d = "2026-11-12 10:00"): PortalJob => ({
  portalId, company, role, deadlineDate: d.slice(0, 10), deadlineTime: d.slice(11),
});
const aj = (id: string, company: string, role: string, d: string | null = "2026-11-12 10:00", o: Partial<AppJob> = {}): AppJob => ({
  id, company, role, roleKeys: [], deadlineDate: d ? d.slice(0, 10) : null, deadlineTime: d && d.length > 10 ? d.slice(11) : null,
  portalId: null, hidden: false, ...o,
});

describe("portal check: parsing and tidying", () => {
  it("keeps only id, company, role and deadline; tidies odd spaces", () => {
    const { jobs, invalid } = parsePortalRows([
      { application_id: "p1", registered_company_name: "The Convergence Foundation ", job_role_name: "Director - PMO", application_deadline: "2026-11-12 10:00", ctc: "secret" },
      { application_id: "p2", registered_company_name: "X", job_role_name: "Y", application_deadline: "12-Nov-2026" },
    ]);
    expect(jobs).toEqual([{ portalId: "p1", company: "The Convergence Foundation", role: "Director - PMO", deadlineDate: "2026-11-12", deadlineTime: "10:00" }]);
    expect(invalid).toBe(1);
    expect(tidy("L’Oréal –  Marketing")).toBe("L'Oréal - Marketing");
  });
  it("spots PPO/PPI-only postings", () => {
    expect(isPpoPpi({ company: "Thoucentric", role: "(ONLY FOR PPI Holders) - IT Project Manager (GBC)" })).toBe(true);
    expect(isPpoPpi({ company: "Razorpay", role: "AI Product Manager - Only for PPO" })).toBe(true);
    expect(isPpoPpi({ company: "Navi", role: "Associate Product Manager II" })).toBe(false);
    expect(isPpoPpi({ company: "Shppo", role: "Happiness lead" })).toBe(false);
  });
  it("runs readings at 8 PM and 9 PM IST only", () => {
    expect(portalSlot(Date.parse("2026-11-11T20:10:00+05:30"))).toBe("8pm");
    expect(portalSlot(Date.parse("2026-11-11T21:45:00+05:30"))).toBe("9pm");
    expect(portalSlot(Date.parse("2026-11-11T22:00:00+05:30"))).toBeNull();
  });
});

describe("portal check: planning", () => {
  it("matches despite stray spaces, curly quotes, dashes and Pvt/Ltd — no duplicates", () => {
    const app = [
      aj("a1", "The Convergence Foundation", "Director - PMO"),
      aj("a2", "L’Oréal", "Senior Management Trainee – Marketing"),
      aj("a3", "EY Global Delivery Services India Pvt Ltd", "Manager (S&T - Deal Technology)"),
    ];
    const portal = [
      pj("p1", "The Convergence Foundation ", "Director - PMO"),
      pj("p2", "L'Oréal", "Senior Management Trainee - Marketing"),
      pj("p3", "EY Global Delivery Services India Private Limited", "Manager (S&T – Deal Technology)"),
    ];
    const plan = planPortalSync(app, portal, portal, now);
    expect(plan.add).toEqual([]);
    expect(plan.hide).toEqual([]);
    expect(plan.link.map((l) => l.jobId).sort()).toEqual(["a1", "a2", "a3"]);
  });
  it("adds a portal-only job (PRAGATI) and skips PPO/PPI ones", () => {
    const plan = planPortalSync(
      [aj("gati", "The Convergence Foundation", "GATI Foundation - Program Manager")],
      [
        pj("p1", "The Convergence Foundation", "GATI Foundation - Program Manager"),
        pj("p2", "The Convergence Foundation", "Chief of Staff - PRAGATI"),
        pj("p3", "Thoucentric", "(ONLY FOR PPI Holders) - Global Leadership Program"),
      ],
      null,
      now,
    );
    expect(plan.add.map((p) => p.role)).toEqual(["Chief of Staff - PRAGATI"]);
    expect(plan.skipped.map((p) => p.company)).toEqual(["Thoucentric"]);
  });
  it("ignores portal jobs whose deadline has already passed", () => {
    const plan = planPortalSync([], [pj("p1", "Sirion", "Product Manager", "2026-11-11 20:00")], null, now);
    expect(plan.add).toEqual([]);
  });
  it("updates the deadline, including filling in a time for a date-only job", () => {
    const plan = planPortalSync(
      [aj("a1", "Tolaram Group", "Brand Manager", "2026-11-12"), aj("a2", "Navi", "APM", "2026-11-12 10:00", { portalId: "p2" })],
      [pj("p1", "Tolaram Group", "Brand Manager", "2026-11-12 22:00"), pj("p2", "Navi", "APM", "2026-11-14 10:00")],
      null,
      now,
    );
    expect(plan.deadline.map((d) => [d.jobId, d.from, `${d.to.deadlineDate} ${d.to.deadlineTime}`]).sort()).toEqual([
      ["a1", "2026-11-12", "2026-11-12 22:00"],
      ["a2", "2026-11-12 10:00", "2026-11-14 10:00"],
    ]);
  });
  it("updates an extended job instead of adding a duplicate, even if the app copy had passed", () => {
    const plan = planPortalSync([aj("a1", "IDfy", "Technical Lead", "2026-11-03 11:00")], [pj("p1", "IDfy", "Technical Lead", "2026-11-13 11:00")], null, now);
    expect(plan.add).toEqual([]);
    expect(plan.deadline).toHaveLength(1);
  });
  it("treats a renamed role as the same job when it is the only unmatched pair for that company and deadline", () => {
    const plan = planPortalSync(
      [aj("a1", "Media.net", "Associate Product Manager"), aj("a2", "Media.net", "Data Analyst", "2026-11-13 10:00")],
      [pj("p1", "Media.net", "Associate Product Manager (APM)"), pj("p2", "Media.net", "Data Analyst", "2026-11-13 10:00")],
      null,
      now,
    );
    expect(plan.add).toEqual([]);
    expect(plan.link.find((l) => l.portalId === "p1")?.jobId).toBe("a1");
  });
  it("does not guess when two roles of a company share a deadline", () => {
    const plan = planPortalSync(
      [aj("a1", "Navi", "Role A"), aj("a2", "Navi", "Role B")],
      [pj("p1", "Navi", "Role C"), pj("p2", "Navi", "Role D")],
      null,
      now,
    );
    expect(plan.add).toHaveLength(2);
  });
  it("hides only jobs seen on the portal before and missing from both readings", () => {
    const app = [
      aj("gone", "Navi", "Role A", "2026-11-12 10:00", { portalId: "p1" }),
      aj("emailOnly", "IDfy", "Technical Lead", "2026-11-12 10:00"),
      aj("blip", "Navi", "Role B", "2026-11-12 10:00", { portalId: "p2" }),
      aj("past", "Navi", "Role C", "2026-11-10 10:00", { portalId: "p3" }),
    ];
    const at8 = [pj("p2", "Navi", "Role B")];
    const plan = planPortalSync(app, [], at8, now);
    expect(plan.hide).toEqual([{ jobId: "gone" }]);
    // No 8 PM reading: never hide.
    expect(planPortalSync(app, [], null, now).hide).toEqual([]);
  });
  it("brings a hidden job back when it reappears", () => {
    const plan = planPortalSync([aj("a1", "Navi", "Role A", "2026-11-12 10:00", { portalId: "p1", hidden: true })], [pj("p1", "Navi", "Role A")], null, now);
    expect(plan.unhide).toEqual([{ jobId: "a1" }]);
    expect(plan.add).toEqual([]);
  });
  it("summarises changes for the owner", () => {
    expect(changeSummary({ add: [pj("p", "a", "b")], deadline: [], hide: [], unhide: [] })).toBe("Portal check: 1 added");
    expect(changeSummary({ add: [], deadline: [], hide: [], unhide: [] })).toBeNull();
  });
});
