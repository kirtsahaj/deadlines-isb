import { applyEvent, companyKey, matchJob, type JobFacts } from "./merge";
import { parseMime, bareAddress, type MimePart } from "./mime";
import { classifyCas, extractCas, findInline, findOriginal, type OriginalMessage, type ParsedJobEvent } from "./parse";
import { safeFilename, sha256Hex, sniffDocument } from "./files";

export type ReceiverAuth = { spf?: string; dkim?: string; dmarc?: string } | null;

export type InboundInput = {
  providerId: string;
  to: string[];
  receivedFor: string[];
  from: string;
  auth: ReceiverAuth;
  raw: Uint8Array | null;
  /** Provider-parsed text when the raw message is unavailable (inline forwards only). */
  fallback: { subject: string; text: string } | null;
};

export type IngestConfig = { recipient: string; forwarders: string[]; sender: string };

export type StoredEvent = { id: string; payload: ParsedJobEvent; sentAt: string };

export type EventRow = { id: string; created: boolean; state: string; payload: ParsedJobEvent; sentAt: string };

/** An unfinished event claimed longer ago than this is presumed abandoned (crashed worker). */
export const EVENT_LEASE_MS = 2 * 60_000;

export type FileInput = { eventId: string; bytes: Uint8Array; filename: string; mime: string; ext: string; sha256: string };

export interface JobStore {
  /** False when this provider message already finished (idempotent retries). */
  claimInbound(providerId: string): Promise<boolean>;
  finishInbound(providerId: string, status: IngestStatus, reason: string, meta?: { subject?: string; messageId?: string | null; sentAt?: string | null }): Promise<void>;
  /**
   * Records the original CAS email once (keyed by originalKey) in state "applying", claimed by this caller.
   * When it already exists, returns the stored row instead so unfinished work can be resumed.
   */
  insertEvent(e: { originalKey: string; companyKey: string; kind: string; payload: ParsedJobEvent; sentAt: string }): Promise<EventRow>;
  /** Atomically takes over an unfinished event whose claim is older than staleBefore. */
  claimEvent(id: string, staleBefore: string): Promise<boolean>;
  jobsForCompany(companyKey: string): Promise<JobFacts[]>;
  saveJob(job: JobFacts): Promise<string>;
  pendingEvents(companyKey: string): Promise<StoredEvent[]>;
  markEvent(id: string, state: "applied" | "pending" | "unspecified" | "ambiguous", jobId: string | null): Promise<void>;
  saveFile(f: FileInput): Promise<void>;
  linkEventFiles(eventId: string, jobId: string): Promise<void>;
}

export type IngestStatus = "processed" | "ignored" | "quarantined";
/** Thrown when another delivery is applying the same original right now; the caller should ask the provider to retry. */
export class InProgressError extends Error {
  constructor() {
    super("in_progress");
  }
}
export type IngestResult = { status: IngestStatus; reason: string };

/** Provider signature proves Resend sent the event; this checks who forwarded it and to where. */
export function checkEnvelope(input: InboundInput, cfg: IngestConfig): IngestResult | null {
  const recipients = [...input.to, ...input.receivedFor].map(bareAddress);
  if (!recipients.includes(cfg.recipient.toLowerCase())) return { status: "ignored", reason: "wrong_recipient" };
  if (!cfg.forwarders.map((f) => f.toLowerCase()).includes(bareAddress(input.from))) return { status: "quarantined", reason: "unknown_forwarder" };
  const a = input.auth;
  // Results computed by Resend's receiving server (not header text the sender could write).
  if (!a || ![a.dmarc, a.dkim, a.spf].includes("pass")) return { status: "quarantined", reason: "unauthenticated_forwarder" };
  return null;
}

function locateOriginal(input: InboundInput, root: MimePart | null, sender: string): OriginalMessage | null {
  if (root) return findOriginal(root, sender);
  if (input.fallback) {
    const inline = findInline(input.fallback.text, sender);
    return inline ? { ...inline, attachments: [], via: "inline" } : null;
  }
  return null;
}

export async function ingest(store: JobStore, input: InboundInput, cfg: IngestConfig): Promise<IngestResult> {
  if (!(await store.claimInbound(input.providerId))) return { status: "processed", reason: "already_processed" };
  const finish = async (r: IngestResult, meta?: Parameters<JobStore["finishInbound"]>[3]) => {
    await store.finishInbound(input.providerId, r.status, r.reason, meta);
    return r;
  };

  const envelope = checkEnvelope(input, cfg);
  if (envelope) return finish(envelope);

  const root = input.raw ? parseMime(input.raw) : null;
  // The raw message Resend stored must itself be from the authenticated forwarder, not just the API summary.
  if (root && bareAddress(root.headers["from"]) !== bareAddress(input.from)) return finish({ status: "quarantined", reason: "raw_sender_mismatch" });
  const original = locateOriginal(input, root, cfg.sender);
  if (!original) return finish({ status: "ignored", reason: "not_cas" });
  const meta = { subject: original.subject.slice(0, 300), messageId: original.messageId, sentAt: original.sentAt };

  const cls = classifyCas(original.subject, original.text);
  if (!cls.kind) return finish({ status: "ignored", reason: cls.reason }, meta);
  const event = extractCas(original.subject, original.text, cls.kind, original.html ?? "");
  if (!event) return finish({ status: "quarantined", reason: "unparsed_template" }, meta);

  const sentAt = original.sentAt ?? new Date().toISOString();
  const originalKey = original.messageId
    ? `mid:${original.messageId.toLowerCase()}`
    : `sha:${await sha256Hex(`${original.subject}\n${original.sentAt ?? ""}\n${original.text.replace(/\s+/g, " ").trim()}`)}`;
  const cKey = companyKey(event.company);
  const row = await store.insertEvent({ originalKey, companyKey: cKey, kind: event.kind, payload: event, sentAt });
  const eventId = row.id;
  if (!row.created) {
    if (row.state !== "applying") return finish({ status: "processed", reason: "duplicate_original" }, meta);
    // A previous attempt stopped mid-way (or is running now): resume it once its claim has lapsed.
    if (!(await store.claimEvent(row.id, new Date(Date.now() - EVENT_LEASE_MS).toISOString()))) throw new InProgressError();
  }
  const stored: StoredEvent = row.created ? { id: eventId, payload: event, sentAt } : { id: row.id, payload: row.payload, sentAt: row.sentAt };

  for (const att of original.attachments) {
    const sniff = sniffDocument(att.body, att.filename);
    if (!sniff) continue;
    await store.saveFile({ eventId, bytes: att.body, filename: safeFilename(att.filename, sniff.ext), mime: sniff.mime, ext: sniff.ext, sha256: await sha256Hex(att.body) });
  }

  const outcome = await applyStored(store, companyKey(stored.payload.company), stored);
  await reconcile(store, companyKey(stored.payload.company));
  return finish({ status: "processed", reason: outcome }, meta);
}

async function applyStored(store: JobStore, cKey: string, ev: StoredEvent): Promise<string> {
  const jobs = await store.jobsForCompany(cKey);
  const match = matchJob(jobs, ev.payload);
  if (match.type === "ambiguous") {
    await store.markEvent(ev.id, "ambiguous", null);
    return "ambiguous";
  }
  if (match.type === "none" && ev.payload.kind === "modified") {
    await store.markEvent(ev.id, "pending", null);
    // The original may have landed concurrently; try once more so the update is not stranded.
    const again = matchJob(await store.jobsForCompany(cKey), ev.payload);
    if (again.type === "job") return applyStored(store, cKey, ev);
    return "pending";
  }
  const { job, outcome } = applyEvent(match.type === "job" ? match.job : null, ev.payload, ev.sentAt);
  const jobId = outcome === "noop" || outcome === "unspecified" ? job.id! : await store.saveJob(job);
  await store.markEvent(ev.id, outcome === "unspecified" ? "unspecified" : "applied", jobId);
  await store.linkEventFiles(ev.id, jobId);
  return outcome;
}

/** Updates that arrived before their original are applied in original-email order once it exists. */
async function reconcile(store: JobStore, cKey: string) {
  const pending = (await store.pendingEvents(cKey)).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  for (const ev of pending) {
    const jobs = await store.jobsForCompany(cKey);
    if (matchJob(jobs, ev.payload).type !== "job") continue;
    await applyStored(store, cKey, ev);
  }
}

