import { describe, expect, it } from "vitest";
import { isAdminEmail, shouldRecordVisit } from "../admin";

describe("admin access", () => {
  it("allows only kirt_singh_pgp2027@isb.edu", () => {
    expect(isAdminEmail("Kirt_Singh_PGP2027@isb.edu ")).toBe(true);
    expect(isAdminEmail("suraj_kasat_pgp2027@isb.edu")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
  it("records a visit at most every 5 minutes", () => {
    const now = Date.parse("2026-10-20T10:00:00Z");
    expect(shouldRecordVisit(null, now)).toBe(true);
    expect(shouldRecordVisit("2026-10-20T09:56:00Z", now)).toBe(false);
    expect(shouldRecordVisit("2026-10-20T09:55:00Z", now)).toBe(true);
  });
});
