import type { JobFacts } from "../merge";
import type { FileInput, InboundInput, JobStore, StoredEvent } from "../pipeline";
import type { ParsedJobEvent } from "../parse";

export const CFG = { recipient: "cas-jobs-74c9b2f6@meibime.resend.app", forwarders: ["kirt_singh_pgp2027@isb.edu"], sender: "cas@isb.edu" };
export const OWNER = "Kirt Singh <kirt_singh_pgp2027@isb.edu>";
export const CAS = "CAS <cas@isb.edu>";

const enc = (s: string) => new TextEncoder().encode(s);
const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");

export function casOriginal(o: { subject: string; body: string; date?: string; messageId?: string; html?: boolean; attachment?: { name: string; mime: string; bytes: Uint8Array } }): string {
  const headers = [`From: ${CAS}`, `To: students@isb.edu`, `Subject: ${o.subject}`, `Date: ${o.date ?? "Thu, 22 Oct 2026 15:12:00 +0530"}`];
  if (o.messageId) headers.push(`Message-ID: <${o.messageId}>`);
  const bodyPart = o.html
    ? `Content-Type: text/html; charset=utf-8\n\n<html><body>${o.body.split("\n").map((l) => `<p>${l}</p>`).join("")}<img src="https://track.example.com/open.gif?u=1" width="1" height="1"></body></html>`
    : `Content-Type: text/plain; charset=utf-8\n\n${o.body}`;
  if (!o.attachment) return crlf(`${headers.join("\n")}\n${bodyPart}\n`);
  const b64 = btoa(String.fromCharCode(...o.attachment.bytes));
  return crlf(`${headers.join("\n")}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="orig"

--orig
${bodyPart}
--orig
Content-Type: image/png; name="logo.png"
Content-Disposition: inline; filename="logo.png"
Content-ID: <logo1>
Content-Transfer-Encoding: base64

iVBORw0KGgo=
--orig
Content-Type: ${o.attachment.mime}; name="${o.attachment.name}"
Content-Disposition: attachment; filename="${o.attachment.name}"
Content-Transfer-Encoding: base64

${b64}
--orig--
`);
}

/** Outlook rule "forward as attachment": the original is a message/rfc822 part. */
export function forwardAsAttachment(original: string, from = OWNER): Uint8Array {
  return enc(crlf(`From: ${from}
To: ${CFG.recipient}
Subject: FW: forwarded
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="outer"

--outer
Content-Type: text/plain; charset=utf-8

--outer
Content-Type: message/rfc822
Content-Disposition: attachment; filename="original.eml"

${original}
--outer--
`));
}

export function forwardInline(subject: string, body: string, from = OWNER): Uint8Array {
  return enc(crlf(`From: ${from}
To: ${CFG.recipient}
Subject: FW: ${subject}
Content-Type: text/plain; charset=utf-8

________________________________
From: ${CAS}
Sent: Thursday, October 22, 2026 3:12 PM
To: Students
Subject: ${subject}

${body}
`));
}

export function inbound(raw: Uint8Array, o: Partial<InboundInput> = {}): InboundInput {
  return {
    providerId: o.providerId ?? crypto.randomUUID(),
    to: [CFG.recipient],
    receivedFor: [],
    from: "kirt_singh_pgp2027@isb.edu",
    auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
    raw,
    fallback: null,
    ...o,
  };
}

export class MemoryStore implements JobStore {
  inbound = new Map<string, { status: string; reason?: string }>();
  events: (StoredEvent & { originalKey: string; companyKey: string; state: string; jobId: string | null; claimedAt: number })[] = [];
  jobs: JobFacts[] = [];
  files: (FileInput & { id: string; jobId: string | null })[] = [];
  jd = new Map<string, string>();
  private n = 0;
  async claimInbound(id: string) {
    const row = this.inbound.get(id);
    if (row && row.status !== "received") return false;
    this.inbound.set(id, { status: "received" });
    return true;
  }
  async finishInbound(id: string, status: string, reason: string) {
    this.inbound.set(id, { status, reason });
  }
  /** Names of store methods that should throw once (simulated transient failure). */
  failOnce = new Set<string>();
  now = () => Date.now();
  private trip(name: string) {
    if (this.failOnce.delete(name)) throw new Error(`transient_${name}`);
  }
  async insertEvent(e: { originalKey: string; companyKey: string; payload: ParsedJobEvent; sentAt: string }) {
    const old = this.events.find((x) => x.originalKey === e.originalKey);
    if (old) return { id: old.id, created: false, state: old.state, payload: old.payload, sentAt: old.sentAt };
    const id = `ev${++this.n}`;
    this.events.push({ id, originalKey: e.originalKey, companyKey: e.companyKey, payload: e.payload, sentAt: e.sentAt, state: "applying", jobId: null, claimedAt: this.now() });
    this.trip("afterInsertEvent");
    return { id, created: true, state: "applying", payload: e.payload, sentAt: e.sentAt };
  }
  async claimEvent(id: string, staleBefore: string) {
    const e = this.events.find((x) => x.id === id);
    if (!e || e.state !== "applying" || e.claimedAt >= new Date(staleBefore).getTime()) return false;
    e.claimedAt = this.now();
    return true;
  }
  async jobsForCompany(key: string) {
    return this.jobs.filter((j) => j.companyKey === key).map((j) => structuredClone(j));
  }
  async saveJob(job: JobFacts) {
    this.trip("saveJob");
    if (!job.id) {
      const id = `job${++this.n}`;
      this.jobs.push({ ...job, id });
      return id;
    }
    this.jobs = this.jobs.map((j) => (j.id === job.id ? structuredClone(job) : j));
    return job.id;
  }
  async pendingEvents(key: string) {
    return this.events.filter((e) => e.companyKey === key && e.state === "pending");
  }
  async markEvent(id: string, state: string, jobId: string | null) {
    const e = this.events.find((x) => x.id === id)!;
    e.state = state;
    e.jobId = jobId;
  }
  async saveFile(f: FileInput) {
    this.trip("saveFile");
    if (this.files.some((x) => x.eventId === f.eventId && x.sha256 === f.sha256)) return;
    this.files.push({ ...f, id: `file${++this.n}`, jobId: null });
  }
  async linkEventFiles(eventId: string, jobId: string) {
    const fs = this.files.filter((f) => f.eventId === eventId);
    fs.forEach((f) => (f.jobId = jobId));
    if (fs[0]) this.jd.set(jobId, fs[0].id);
  }
  job(company: string, role?: string) {
    return this.jobs.find((j) => j.company.toLowerCase().includes(company.toLowerCase()) && (!role || j.role === role));
  }
}
