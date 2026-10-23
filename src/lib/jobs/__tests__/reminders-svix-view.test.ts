import { describe, expect, it } from "vitest";
import { dueJobOffsets, jobReminderKey, planJobReminders } from "../reminders";
import { signSvix, verifySvix } from "../svix";
import { jobsInView } from "../view";
import type { JobTile } from "@/lib/jobs.functions";

const H = 3600_000;
const now = Date.parse("2026-11-01T10:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();

describe("job reminders: 12h and 3h", () => {
  it("sends the 12-hour notice only in its own tick window (no late catch-up)", () => {
    expect(dueJobOffsets(at(12 * H), now)).toEqual([12]);
    expect(dueJobOffsets(at(12 * H - 10 * 60_000), now)).toEqual([12]);
    expect(dueJobOffsets(at(12 * H + 60_000), now)).toEqual([]);
    expect(dueJobOffsets(at(8 * H), now)).toEqual([]);
  });
  it("sends the 3-hour notice inside 3 hours, never after the deadline", () => {
    expect(dueJobOffsets(at(3 * H), now)).toEqual([3]);
    expect(dueJobOffsets(at(3 * H + 60_000), now)).toEqual([]);
    expect(dueJobOffsets(at(-1), now)).toEqual([]);
  });
  it("never reminds for a date-only deadline", () => {
    expect(dueJobOffsets(null, now)).toEqual([]);
  });
  it("dedupes per user/job/due time/offset and re-arms when the deadline changes", () => {
    const jobs = [{ id: "j1", deadlineAt: at(3 * H) }];
    const first = planJobReminders(jobs, ["u1", "u2"], now);
    expect(first).toHaveLength(2);
    const claimed = new Set(first.map((r) => jobReminderKey(r.userId, r.jobId, r.dueAt, r.offset)));
    expect(planJobReminders(jobs, ["u1", "u2"], now + 15 * 60_000, claimed)).toHaveLength(0);
    const moved = [{ id: "j1", deadlineAt: at(2 * H) }];
    expect(planJobReminders(moved, ["u1"], now, claimed)).toEqual([{ userId: "u1", jobId: "j1", dueAt: at(2 * H), offset: 3 }]);
  });
  it("12h and 3h are independent claims for the same deadline", () => {
    const due = at(12 * H);
    const claimed = new Set([jobReminderKey("u1", "j1", due, 12)]);
    expect(planJobReminders([{ id: "j1", deadlineAt: due }], ["u1"], now + 9 * H, claimed)).toEqual([{ userId: "u1", jobId: "j1", dueAt: due, offset: 3 }]);
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
  const tile = (p: Partial<JobTile>): JobTile => ({ id: p.id ?? "x", company: "Co", role: "Role", deadlineDate: null, deadlineTime: null, deadlineAt: null, shortlistDate: null, hasJd: false, updatedAt: "2026-10-01T00:00:00Z", starred: false, ...p });
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
});
