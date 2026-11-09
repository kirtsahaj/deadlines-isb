import { describe, expect, it } from "vitest";
import { dueJobSummary, jobAlertsOn, jobSummaryClaim, jobSummaryMessage, newJobWorthAnnouncing } from "../reminders";
import { signSvix, verifySvix } from "../svix";
import { jobsInView } from "../view";
import type { JobTile } from "@/lib/jobs.functions";

const H = 3600_000;
const now = Date.parse("2026-11-01T10:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();

describe("job reminders: daily summaries", () => {
  // Mon 9 Nov 2026, IST times
  const ist = (hhmm: string, day = "2026-11-09") => Date.parse(`${day}T${hhmm}:00+05:30`);
  const job = (company: string, o: { at?: string; date?: string }) => ({
    id: company, company, role: "Analyst",
    deadlineAt: o.at ? new Date(o.at).toISOString() : null, deadlineDate: o.date ?? null,
  });

  it("is due from 10 PM to midnight and from 8 to 10 AM IST only", () => {
    expect(dueJobSummary(ist("21:59"))).toBeNull();
    expect(dueJobSummary(ist("22:00"))).toBe("night");
    expect(dueJobSummary(ist("23:45"))).toBe("night");
    expect(dueJobSummary(ist("07:59"))).toBeNull();
    expect(dueJobSummary(ist("08:10"))).toBe("morning");
    expect(dueJobSummary(ist("10:00"))).toBeNull();
  });
  it("claims once per kind and IST day", () => {
    expect(jobSummaryClaim("night", ist("22:15"))).toEqual(jobSummaryClaim("night", ist("23:50")));
    expect(jobSummaryClaim("night", ist("22:15")).dueAt).not.toBe(jobSummaryClaim("night", ist("22:15", "2026-11-10")).dueAt);
    expect(jobSummaryClaim("morning", ist("08:00")).key).not.toBe(jobSummaryClaim("night", ist("22:00")).key);
  });
  it("night: same jobs as the 10 PM mail, date-only only the night before", () => {
    const jobs = [
      job("Amazon", { at: "2026-11-10T10:00:00+05:30" }),
      job("Virtusa", { at: "2026-11-10T11:00:00+05:30" }),
      job("Later", { at: "2026-11-11T09:00:00+05:30" }),
      job("YCP", { date: "2026-11-10" }),
      job("TodayDateOnly", { date: "2026-11-09" }),
    ];
    expect(jobSummaryMessage("night", jobs, ist("22:00"))).toEqual({
      title: "3 job applications closing in the next 24 hours",
      body: "Amazon, Virtusa, YCP",
    });
    // Next night: YCP (closing 10 Nov) does not repeat.
    expect(jobSummaryMessage("night", jobs, ist("22:00", "2026-11-10"))).toEqual({
      title: "1 job application closing in the next 24 hours",
      body: "Later",
    });
  });
  it("morning: exact deadlines later today with times; date-only left out", () => {
    const jobs = [
      job("Virtusa", { at: "2026-11-10T11:00:00+05:30" }),
      job("Amazon", { at: "2026-11-10T10:00:00+05:30" }),
      job("Gone", { at: "2026-11-10T07:00:00+05:30" }),
      job("Tomorrow", { at: "2026-11-11T09:00:00+05:30" }),
      job("YCP", { date: "2026-11-10" }),
    ];
    expect(jobSummaryMessage("morning", jobs, ist("08:00", "2026-11-10"))).toEqual({
      title: "2 applications close today",
      body: "Amazon 10:00 am, Virtusa 11:00 am",
    });
    expect(jobSummaryMessage("morning", [jobs[0]!], ist("08:00", "2026-11-10"))?.title).toBe("1 application closes today");
  });
  it("sends nothing when nothing closes, and caps long lists", () => {
    expect(jobSummaryMessage("night", [], ist("22:00"))).toBeNull();
    expect(jobSummaryMessage("morning", [], ist("08:00"))).toBeNull();
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((c) => job(c, { at: "2026-11-10T10:00:00+05:30" }));
    expect(jobSummaryMessage("night", many, ist("22:00"))?.body).toBe("A, B, C, D, E +2 more");
  });
  it("announces new postings only while the deadline can still be met", () => {
    expect(newJobWorthAnnouncing(undefined, now)).toBe(true);
    expect(newJobWorthAnnouncing({ date: "2000-01-01" }, now)).toBe(false);
    expect(newJobWorthAnnouncing({ date: "2999-01-01", time: "11:00" }, now)).toBe(true);
  });
});

describe("webhook signature", () => {
  const secret = "whsec_" + btoa("0123456789abcdef0123456789abcdef");
  const body = new TextEncoder().encode('{"type":"email.received","data":{"email_id":"x"}}');
  const ts = String(Math.floor(now / 1000));
  it("accepts a valid signature on the raw bytes", async () => {
    const sig = await signSvix(secret, "msg_1", ts, body);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: sig }, body, Number(ts))).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets, missing headers and stale timestamps", async () => {
    const sig = await signSvix(secret, "msg_1", ts, body);
    const tampered = new TextEncoder().encode('{"type":"email.received","data":{"email_id":"y"}}');
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: sig }, tampered, Number(ts))).toBe(false);
    expect(await verifySvix("whsec_" + btoa("another-secret-another-secret!!"), { id: "msg_1", timestamp: ts, signature: sig }, body, Number(ts))).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: null }, body, Number(ts))).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: sig }, body, Number(ts) + 600)).toBe(false);
  });
});

describe("placements list", () => {
  const tile = (p: Partial<JobTile>): JobTile => ({ id: p.id ?? "x", company: "Co", role: "Role", deadlineDate: null, deadlineTime: null, deadlineAt: null, shortlistDate: null, hasJd: false, updatedAt: "2026-10-01T00:00:00Z", addedAt: "2026-10-01T00:00:00Z", starred: false, ...p });
  const jobs = [
    tile({ id: "late", deadlineDate: "2026-11-09", deadlineAt: "2026-11-09T05:30:00Z" }),
    tile({ id: "soon", deadlineDate: "2026-11-02", deadlineAt: "2026-11-02T05:30:00Z", starred: true }),
    tile({ id: "dateonly", deadlineDate: "2026-11-01" }),
    tile({ id: "past", deadlineDate: "2026-10-20", deadlineAt: "2026-10-20T05:30:00Z", hasJd: true }),
    tile({ id: "undated" }),
  ];
  const base = { view: "upcoming" as const, sort: "deadline" as const, filter: "all" as const, search: "", now };
  it("shows the nearest future deadline first; undated last; passed ones in Older", () => {
    expect(jobsInView(jobs, base).map((j) => j.id)).toEqual(["dateonly", "soon", "late"]);
    expect(jobsInView(jobs, { ...base, view: "older" }).map((j) => j.id)).toEqual(["past", "undated"]);
  });
  it("filters starred and JD-only", () => {
    expect(jobsInView(jobs, { ...base, filter: "starred" }).map((j) => j.id)).toEqual(["soon"]);
    expect(jobsInView(jobs, { ...base, view: "older", filter: "jd" }).map((j) => j.id)).toEqual(["past"]);
  });
  it("Added on sorts newest CAS email first, still upcoming only", () => {
    const added = [
      tile({ id: "old", deadlineAt: "2026-11-05T05:30:00Z", deadlineDate: "2026-11-05", addedAt: "2026-10-20T04:00:00Z" }),
      tile({ id: "new", deadlineAt: "2026-11-09T05:30:00Z", deadlineDate: "2026-11-09", addedAt: "2026-10-27T04:00:00Z" }),
      tile({ id: "mid", deadlineAt: "2026-11-02T05:30:00Z", deadlineDate: "2026-11-02", addedAt: "2026-10-24T04:00:00Z" }),
      tile({ id: "gone", deadlineAt: "2026-10-21T05:30:00Z", deadlineDate: "2026-10-21", addedAt: "2026-10-28T04:00:00Z" }),
    ];
    expect(jobsInView(added, { ...base, sort: "added" }).map((j) => j.id)).toEqual(["new", "mid", "old"]);
    expect(jobsInView(added, base).map((j) => j.id)).toEqual(["mid", "old", "new"]);
  });
});

describe("job alerts bell", () => {
  it("keeps everyone except users who explicitly turned job alerts off", () => {
    const settings = [
      { user_id: "off", job_reminders: false },
      { user_id: "on", job_reminders: true },
      { user_id: "unset", job_reminders: null },
    ];
    expect(jobAlertsOn(["off", "on", "unset", "no-row"], settings)).toEqual(["on", "unset", "no-row"]);
  });
});
