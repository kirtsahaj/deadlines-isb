import { describe, expect, it } from "vitest";
import { ingest } from "../pipeline";
import { CFG, casOriginal, forwardAsAttachment, forwardInline, inbound, MemoryStore, OWNER } from "./fixtures";
import { istInstant, parseDateParts } from "../parse";

const SYSTEMATIX_SUBJECT = "Analyst- Institutional Equity Research | Systematix Group | Broadcasted";
const SYSTEMATIX_BODY = `Dear Students,
Company Name: Systematix Group
Job Title: Analyst- Institutional Equity Research
Application Deadline: 04-Nov-2026 11:00 AM
Expected Shortlist Date: 2026-11-16
Please apply on the placement portal: https://portal.example/login`;

const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");

function broadcast(company: string, role: string, lines: string, o: { date?: string; messageId?: string; attachment?: { name: string; mime: string; bytes: Uint8Array } } = {}) {
  return forwardAsAttachment(casOriginal({ subject: `${role} | ${company} | Broadcasted`, body: `Company Name: ${company}\nRole: ${role}\n${lines}`, ...o }));
}
function modified(company: string, role: string, lines: string, date: string, messageId?: string) {
  const extra = messageId ? { messageId } : {};
  return forwardAsAttachment(casOriginal({ subject: `${role} | ${company} | Job Details Modified`, body: `Company Name: ${company}\n${lines}`, date, ...extra }));
}

describe("date parsing", () => {
  it("reads CAS formats and never invents a missing time", () => {
    expect(parseDateParts("04-Nov-2026 11:00 AM")).toEqual({ date: "2026-11-04", time: "11:00" });
    expect(parseDateParts("2026-11-16")).toEqual({ date: "2026-11-16" });
    expect(parseDateParts("8:00 PM")).toEqual({ time: "20:00" });
    expect(istInstant("2026-11-04", null)).toBeNull();
    expect(istInstant("2026-11-04", "11:00")).toBe("2026-11-04T05:30:00.000Z");
  });
});

describe("intake: message shapes", () => {
  it("inline forward (the verified live sample shape) creates one job", async () => {
    const s = new MemoryStore();
    const r = await ingest(s, inbound(forwardInline(SYSTEMATIX_SUBJECT, SYSTEMATIX_BODY)), CFG);
    expect(r).toEqual({ status: "processed", reason: "created" });
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]).toMatchObject({ company: "Systematix Group", role: "Analyst- Institutional Equity Research", deadlineDate: "2026-11-04", deadlineTime: "11:00", shortlistDate: "2026-11-16" });
  });

  it("forward-as-attachment HTML original with octet-stream PDF JD; inline logo ignored", async () => {
    const s = new MemoryStore();
    const raw = forwardAsAttachment(casOriginal({ subject: SYSTEMATIX_SUBJECT, body: SYSTEMATIX_BODY, html: true, messageId: "a1@isb", attachment: { name: "JD Systematix.pdf", mime: "application/octet-stream", bytes: pdf } }));
    expect((await ingest(s, inbound(raw), CFG)).reason).toBe("created");
    expect(s.jobs[0]!.deadlineTime).toBe("11:00");
    expect(s.files).toHaveLength(1);
    expect(s.files[0]).toMatchObject({ mime: "application/pdf", filename: "JD Systematix.pdf" });
    expect(s.jd.get(s.jobs[0]!.id!)).toBe(s.files[0]!.id);
  });

  it("rejects a disguised non-document attachment", async () => {
    const s = new MemoryStore();
    const raw = forwardAsAttachment(casOriginal({ subject: SYSTEMATIX_SUBJECT, body: SYSTEMATIX_BODY, attachment: { name: "jd.pdf", mime: "application/pdf", bytes: new TextEncoder().encode("MZ fake exe") } }));
    await ingest(s, inbound(raw), CFG);
    expect(s.files).toHaveLength(0);
  });

  it("finds the original inside a nested forward", async () => {
    const s = new MemoryStore();
    const inner = new TextDecoder().decode(forwardAsAttachment(casOriginal({ subject: SYSTEMATIX_SUBJECT, body: SYSTEMATIX_BODY })));
    const r = await ingest(s, inbound(forwardAsAttachment(inner)), CFG);
    expect(r.reason).toBe("created");
  });
});

describe("intake: what is ignored or quarantined", () => {
  it("ignores personal application, shortlist-result and reminder mail", async () => {
    const s = new MemoryStore();
    const a = await ingest(s, inbound(forwardAsAttachment(casOriginal({ subject: "Application submitted successfully | UBS", body: "Your application has been submitted." }))), CFG);
    const b = await ingest(s, inbound(forwardAsAttachment(casOriginal({ subject: "Analyst | UBS | Broadcasted", body: "Congratulations, you have been shortlisted for the next round." }))), CFG);
    const c = await ingest(s, inbound(forwardAsAttachment(casOriginal({ subject: "Reminder: Analyst | UBS | Broadcasted", body: "Company Name: UBS\nRole: Analyst" }))), CFG);
    expect([a.status, b.status, c.status]).toEqual(["ignored", "ignored", "ignored"]);
    expect(s.jobs).toHaveLength(0);
  });

  it("ignores mail whose original is not from cas@isb.edu, even with the right subject", async () => {
    const s = new MemoryStore();
    const fake = casOriginal({ subject: SYSTEMATIX_SUBJECT, body: SYSTEMATIX_BODY }).replace("From: CAS <cas@isb.edu>", "From: CAS <cas@isb-edu.co>");
    expect((await ingest(s, inbound(forwardAsAttachment(fake)), CFG)).reason).toBe("not_cas");
  });

  it("quarantines an unknown forwarder, a failed receiver authentication, and ignores a wrong recipient", async () => {
    const s = new MemoryStore();
    const raw = forwardInline(SYSTEMATIX_SUBJECT, SYSTEMATIX_BODY);
    expect(await ingest(s, inbound(raw, { from: "attacker@gmail.com" }), CFG)).toEqual({ status: "quarantined", reason: "unknown_forwarder" });
    expect(await ingest(s, inbound(raw, { auth: { spf: "fail", dkim: "fail", dmarc: "fail" } }), CFG)).toEqual({ status: "quarantined", reason: "unauthenticated_forwarder" });
    expect(await ingest(s, inbound(raw, { auth: null }), CFG)).toEqual({ status: "quarantined", reason: "unauthenticated_forwarder" });
    expect(await ingest(s, inbound(raw, { to: ["other@meibime.resend.app"] }), CFG)).toEqual({ status: "ignored", reason: "wrong_recipient" });
    expect(s.jobs).toHaveLength(0);
    void OWNER;
  });
});

describe("intake: idempotency", () => {
  it("a provider retry and a second forward of the same original are both no-ops", async () => {
    const s = new MemoryStore();
    const raw = broadcast("UBS", "Analyst", "Application Deadline: 10-Nov-2026 5:00 PM", { messageId: "ubs-1@isb" });
    const first = inbound(raw, { providerId: "p1" });
    await ingest(s, first, CFG);
    expect((await ingest(s, first, CFG)).reason).toBe("already_processed");
    expect((await ingest(s, inbound(raw, { providerId: "p2" }), CFG)).reason).toBe("duplicate_original");
    expect(s.jobs).toHaveLength(1);
  });

  it("different jobs at the same company stay separate", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("Bain & Company", "Associate Consultant", "Application Deadline: 10-Nov-2026 5:00 PM")), CFG);
    await ingest(s, inbound(broadcast("Bain & Company", "Consultant", "Application Deadline: 12-Nov-2026 5:00 PM")), CFG);
    expect(s.jobs.map((j) => j.role).sort()).toEqual(["Associate Consultant", "Consultant"]);
  });
});

describe("Job Details Modified: explicit fields only", () => {
  it("YCP time-only update keeps the original date", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("YCP", "Associate", "Application Deadline: 10-Nov-2026 5:00 PM\nExpected Shortlist Date: 2026-11-20", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    const r = await ingest(s, inbound(modified("YCP", "Associate", "Application Deadline: 8:00 PM", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG);
    expect(r.reason).toBe("updated");
    expect(s.job("YCP")).toMatchObject({ deadlineDate: "2026-11-10", deadlineTime: "20:00", shortlistDate: "2026-11-20" });
  });

  it("date-only update keeps the established time; omitted fields are never erased", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("YCP", "Associate", "Application Deadline: 10-Nov-2026 5:00 PM\nExpected Shortlist Date: 2026-11-20", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    await ingest(s, inbound(modified("YCP", "Associate", "Application Deadline: 12-Nov-2026", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG);
    expect(s.job("YCP")).toMatchObject({ deadlineDate: "2026-11-12", deadlineTime: "17:00", shortlistDate: "2026-11-20" });
  });

  it("Vector role rename keeps the old title as an alias for later matches", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("Vector Consulting Group", "Analyst", "Application Deadline: 10-Nov-2026 5:00 PM", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    await ingest(s, inbound(modified("Vector Consulting Group", "Analyst", "Job Title: changed from Analyst to Senior Analyst", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG);
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]).toMatchObject({ role: "Senior Analyst", roleAliases: ["Analyst"] });
    await ingest(s, inbound(modified("Vector Consulting Group", "Analyst", "Application Deadline: 11-Nov-2026", "Sat, 24 Oct 2026 10:00:00 +0530")), CFG);
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]!.deadlineDate).toBe("2026-11-11");
  });

  it("UBS: a repeated update with the same new value is a no-op", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("UBS", "Analyst", "Application Deadline: 10-Nov-2026 5:00 PM", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    expect((await ingest(s, inbound(modified("UBS", "Analyst", "Application Deadline: 11-Nov-2026 5:00 PM", "Fri, 23 Oct 2026 10:00:00 +0530", "u1@isb")), CFG)).reason).toBe("updated");
    expect((await ingest(s, inbound(modified("UBS", "Analyst", "Application Deadline: 11-Nov-2026 5:00 PM", "Fri, 23 Oct 2026 12:00:00 +0530", "u2@isb")), CFG)).reason).toBe("noop");
  });

  it("EY: an update that names no field changes nothing", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("EY", "Consultant", "Application Deadline: 10-Nov-2026 5:00 PM", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    const before = structuredClone(s.jobs[0]);
    const r = await ingest(s, inbound(modified("EY", "Consultant", "Some details of this job have been modified. Please check the portal.", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG);
    expect(r.reason).toBe("unspecified");
    expect(s.jobs[0]).toEqual(before);
  });

  it("an update that arrives before its original is held, then applied after it", async () => {
    const s = new MemoryStore();
    expect((await ingest(s, inbound(modified("KPMG", "Manager", "Application Deadline: 15-Nov-2026", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG)).reason).toBe("pending");
    expect(s.jobs).toHaveLength(0);
    await ingest(s, inbound(broadcast("KPMG", "Manager", "Application Deadline: 10-Nov-2026 5:00 PM", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    expect(s.job("KPMG")).toMatchObject({ deadlineDate: "2026-11-15", deadlineTime: "17:00" });
  });

  it("an older update arriving late never overwrites a newer one; unknown roles do not touch other jobs", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(broadcast("UBS", "Analyst", "Application Deadline: 10-Nov-2026 5:00 PM", { date: "Thu, 22 Oct 2026 10:00:00 +0530" })), CFG);
    await ingest(s, inbound(modified("UBS", "Analyst", "Application Deadline: 14-Nov-2026", "Sat, 24 Oct 2026 10:00:00 +0530")), CFG);
    await ingest(s, inbound(modified("UBS", "Analyst", "Application Deadline: 12-Nov-2026", "Fri, 23 Oct 2026 10:00:00 +0530")), CFG);
    expect(s.jobs[0]!.deadlineDate).toBe("2026-11-14");
    expect((await ingest(s, inbound(modified("UBS", "Associate", "Application Deadline: 30-Nov-2026", "Sun, 25 Oct 2026 10:00:00 +0530")), CFG)).reason).toBe("pending");
    expect(s.jobs[0]!.deadlineDate).toBe("2026-11-14");
  });
});
