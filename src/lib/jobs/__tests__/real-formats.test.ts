import { describe, expect, it } from "vitest";
import { EVENT_LEASE_MS, InProgressError, ingest } from "../pipeline";
import { CFG, inbound, MemoryStore, OWNER } from "./fixtures";

/**
 * Shapes copied from the real CAS mails received during the backfill: Outlook inline forwards
 * (multipart/alternative plain + HTML), "Name : value" broadcast lines, and the
 * Field | Previous Value | Present Value modification table with a hidden tracking pixel.
 */
const enc = (s: string) => new TextEncoder().encode(s.replace(/\r?\n/g, "\r\n"));
const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");

function inlineForward(subject: string, sent: string, plain: string, html: string, attachment?: Uint8Array): Uint8Array {
  const alt = `--alt
Content-Type: text/plain; charset="us-ascii"

________________________________
From: cas@isb.edu <cas@isb.edu>
Sent: ${sent}
Subject: ${subject}

${plain}
--alt
Content-Type: text/html; charset="us-ascii"

<html><body><div>From: cas@isb.edu &lt;cas@isb.edu&gt;<br>Sent: ${sent}<br>Subject: ${subject}</div>${html}</body></html>
--alt--`;
  const att = attachment
    ? `
--mix
Content-Type: application/octet-stream; name="JD.pdf"
Content-Disposition: attachment; filename="JD.pdf"
Content-Transfer-Encoding: base64

${btoa(String.fromCharCode(...attachment))}`
    : "";
  return enc(`From: ${OWNER}
To: ${CFG.recipient}
Subject: FW: ${subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="mix"

--mix
Content-Type: multipart/alternative; boundary="alt"

${alt}${att}
--mix--
`);
}

function realBroadcast(company: string, role: string, deadline: string, shortlist: string, sent: string, attachment?: Uint8Array) {
  const subject = `${role} | ${company} | Broadcasted`;
  const plain = `Dear Student,\n\nThe below job has been broadcasted.\n\nCompany Name : ${company}\nRole Name : ${role}\nApplication Deadline : ${deadline}\nShortlist Date: ${shortlist}\n\nPlease log in to the CAS placement portal to view the details.\n\nRegards,\nTeam CAS`;
  const html = `Dear Student,<br><br>The below job has been broadcasted.<br><br>Company Name : ${company}<br>Role Name : ${role}<br>Application Deadline : ${deadline}<br>Shortlist Date: ${shortlist}<br><img src="https://track.example/I0/x" style="display:none; width:1px; height:1px">`;
  return inlineForward(subject, sent, plain, html, attachment);
}

function realModified(company: string, role: string, rows: [string, string, string][], sent: string, o: { htmlOnlyMultiline?: boolean; noHtml?: boolean } = {}) {
  const subject = `${company} - ${role} - Job Details Modified`;
  const intro = `The following details of the Role - ${role} for ${company} has been modified.`;
  const plainRows = rows.map((r) => r.map((c) => c.replace(/<br>/g, "\n")).join("\t")).join("\n");
  const plain = `Dear Student,\n\n${intro}\n\n\nField\tPrevious Value\tPresent Value\n${plainRows}\n[https://track.example/I0/x]\n\nPlease log in to the CAS placement portal to view the details.\n\nRegards\nTeam CAS`;
  const table = `<style>\n<!--\ntable, th, td {border:1px solid #DDEEEE}\n-->\n</style>\n<table>\n<thead>\n<tr>\n<th>Field</th>\n<th>Previous Value</th>\n<th>Present Value</th>\n</tr>\n</thead>\n<tbody>\n${rows
    .map((r) => `<tr>\n${r.map((c) => `<td>${c} </td>`).join("\n")}\n</tr>`)
    .join("\n")}\n</tbody>\n</table>\n<img alt="" src="https://track.example/I0/x" style="display:none; width:1px; height:1px">`;
  const html = `Dear Student,<br><br>${intro}<br><br><br>${table}<br>Please log in to the CAS placement portal to view the details.`;
  if (o.noHtml) {
    return enc(`From: ${OWNER}\nTo: ${CFG.recipient}\nSubject: FW: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n________________________________\nFrom: cas@isb.edu <cas@isb.edu>\nSent: ${sent}\nSubject: ${subject}\n\n${plain}\n`);
  }
  return inlineForward(subject, sent, plain, html);
}

const T0 = "Wednesday, 21 October 2026 10:00:00";
const T1 = "Wednesday, 21 October 2026 11:02:41";
const T2 = "Thursday, 22 October 2026 09:00:00";

describe("real CAS formats", () => {
  it("Vector: real Job Title row renames the role and keeps the old title as an alias", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(realBroadcast("Vector Consulting Group", "Business Consultant Intern", "05-Nov-2026 11:00 AM", "2026-11-26", T0)), CFG);
    const r = await ingest(s, inbound(realModified("Vector Consulting Group", "Business Consultant", [["Job Title", "Business Consultant Intern", "Business Consultant"]], T1)), CFG);
    expect(r).toEqual({ status: "processed", reason: "updated" });
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]).toMatchObject({ role: "Business Consultant", roleAliases: ["Business Consultant Intern"], deadlineDate: "2026-11-05", deadlineTime: "11:00", shortlistDate: "2026-11-26" });
  });

  it("YCP: real Time row 12:00 -> 23:59 keeps the original date", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(realBroadcast("YCP India", "Associate", "10-Nov-2026 12:00 PM", "2026-11-20", T0)), CFG);
    const r = await ingest(s, inbound(realModified("YCP India", "Associate", [["Time", "12:00", "23:59"]], T1)), CFG);
    expect(r.reason).toBe("updated");
    expect(s.job("YCP")).toMatchObject({ deadlineDate: "2026-11-10", deadlineTime: "23:59", shortlistDate: "2026-11-20" });
  });

  it("UBS: a real non-deadline row (Min. Work Exp) twice changes nothing and both are recorded", async () => {
    const s = new MemoryStore();
    const company = "UBS Business Solutions (India) Private Limited";
    await ingest(s, inbound(realBroadcast(company, "Finance Business Partner", "24-Oct-2026 10:00 AM", "2026-11-18", T0)), CFG);
    const a = await ingest(s, inbound(realModified(company, "Finance Business Partner", [["Min. Work Exp(Yrs)", "4", "3"]], T1)), CFG);
    const b = await ingest(s, inbound(realModified(company, "Finance Business Partner", [["Min. Work Exp(Yrs)", "4", "3"]], "Wednesday, 21 October 2026 11:02:55")), CFG);
    expect([a.reason, b.reason]).toEqual(["unspecified", "unspecified"]);
    expect(s.jobs[0]).toMatchObject({ deadlineDate: "2026-10-24", deadlineTime: "10:00" });
  });

  it("Samagra: a multiline Job Description cell is read as one row and changes no facts", async () => {
    const s = new MemoryStore();
    const company = "Samagra Development Associates Private Limited";
    await ingest(s, inbound(realBroadcast(company, "SELP 1 - Emerging Leaders", "25-Oct-2026 10:00 AM", "2026-10-28", T0)), CFG);
    const r = await ingest(s, inbound(realModified(company, "SELP 1 - Emerging Leaders", [["Job Description", "Video Assessment is mandatory<br>CTC : 30 LPA<br>Base salary", "Video Assessment is mandatory<br>CTC : 40 LPA"]], T1)), CFG);
    expect(r.reason).toBe("unspecified");
    expect(s.jobs[0]).toMatchObject({ role: "SELP 1 - Emerging Leaders", deadlineDate: "2026-10-25", deadlineTime: "10:00" });
  });

  it("a multiline deadline cell updates both date and time; an empty present value never erases", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(realBroadcast("Paytm", "Product Manager", "30-Oct-2026 10:00 AM", "2026-11-10", T0)), CFG);
    await ingest(s, inbound(realModified("Paytm", "Product Manager", [["Application Deadline", "30-Oct-2026<br>10:00 AM", "02-Nov-2026<br>11:59 PM"], ["Shortlist Date", "2026-11-10", ""]], T1)), CFG);
    expect(s.jobs[0]).toMatchObject({ deadlineDate: "2026-11-02", deadlineTime: "23:59", shortlistDate: "2026-11-10" });
  });

  it("plain-text-only modification (tab-separated table) is still understood", async () => {
    const s = new MemoryStore();
    await ingest(s, inbound(realBroadcast("Myntra", "Product Manager 2", "26-Oct-2026 10:00 AM", "2026-11-02", T0)), CFG);
    await ingest(s, inbound(realModified("Myntra", "Product Manager 2", [["Date", "26-Oct-2026", "27-Oct-2026"]], T1, { noHtml: true })), CFG);
    expect(s.jobs[0]).toMatchObject({ deadlineDate: "2026-10-27", deadlineTime: "10:00" });
  });

  it("a real modification that arrives before its broadcast is held, then applied", async () => {
    const s = new MemoryStore();
    expect((await ingest(s, inbound(realModified("Vector Consulting Group", "Business Consultant", [["Job Title", "Business Consultant Intern", "Business Consultant"]], T1)), CFG)).reason).toBe("pending");
    await ingest(s, inbound(realBroadcast("Vector Consulting Group", "Business Consultant Intern", "05-Nov-2026 11:00 AM", "2026-11-26", T0)), CFG);
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]!.role).toBe("Business Consultant");
  });
});

describe("transient failures and concurrent delivery", () => {
  it("saveJob failing after the event is recorded is resumed on retry, not lost as a duplicate", async () => {
    const s = new MemoryStore();
    const input = inbound(realBroadcast("ProcDNA", "Engagement Lead", "28-Oct-2026 10:00 AM", "2026-11-06", T0, pdf));
    s.failOnce.add("saveJob");
    await expect(ingest(s, input, CFG)).rejects.toThrow("transient_saveJob");
    expect(s.jobs).toHaveLength(0);
    // An immediate retry while the first attempt might still be running asks the provider to retry later.
    await expect(ingest(s, input, CFG)).rejects.toBeInstanceOf(InProgressError);
    // Once the claim lapses, the retry resumes the recorded event.
    s.events[0]!.claimedAt -= EVENT_LEASE_MS + 1;
    expect(await ingest(s, input, CFG)).toEqual({ status: "processed", reason: "created" });
    expect(s.jobs).toHaveLength(1);
    expect(s.events[0]!.state).toBe("applied");
    expect(s.files).toHaveLength(1);
    expect(s.jd.get(s.jobs[0]!.id!)).toBe(s.files[0]!.id);
    expect(s.inbound.get(input.providerId)?.status).toBe("processed");
    expect(await ingest(s, input, CFG)).toEqual({ status: "processed", reason: "already_processed" });
  });

  it("a JD upload failure is resumed and the file is stored once", async () => {
    const s = new MemoryStore();
    const input = inbound(realBroadcast("Myntra", "Product Manager 2", "26-Oct-2026 10:00 AM", "2026-11-02", T0, pdf));
    s.failOnce.add("saveFile");
    await expect(ingest(s, input, CFG)).rejects.toThrow();
    s.events[0]!.claimedAt -= EVENT_LEASE_MS + 1;
    await ingest(s, input, CFG);
    expect(s.files).toHaveLength(1);
    expect(s.jobs).toHaveLength(1);
  });

  it("a crash after recording the event, then a different forward of the same original, resumes once", async () => {
    const s = new MemoryStore();
    s.failOnce.add("afterInsertEvent");
    const mail = realBroadcast("Lonza Indian Systems Private Limited", "Finance Manager", "26-Oct-2026 10:00 AM", "2026-11-02", T0);
    await expect(ingest(s, inbound(mail), CFG)).rejects.toThrow();
    s.events[0]!.claimedAt -= EVENT_LEASE_MS + 1;
    expect((await ingest(s, inbound(mail), CFG)).reason).toBe("created");
    expect((await ingest(s, inbound(mail), CFG)).reason).toBe("duplicate_original");
    expect(s.jobs).toHaveLength(1);
  });

  it("two concurrent deliveries of the same original create one job", async () => {
    const s = new MemoryStore();
    const mail = realBroadcast("Aster DM Healthcare", "Management Trainee - Healthcare Operations", "25-Oct-2026 10:00 AM", "2026-10-27", T2);
    const results = await Promise.allSettled([ingest(s, inbound(mail), CFG), ingest(s, inbound(mail), CFG)]);
    expect(s.jobs).toHaveLength(1);
    const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ reason: string }>).value.reason);
    expect(ok).toContain("created");
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(InProgressError);
  });
});
