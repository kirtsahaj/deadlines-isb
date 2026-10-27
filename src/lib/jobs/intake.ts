/**
 * Pure helpers for the Placements email-intake health view and alerts.
 * Rows come from job_inbound_messages (one per Resend email).
 */
export type InboundRow = {
  id: string;
  status: string;
  reason: string | null;
  subject: string | null;
  received_at: string;
};

/** A stuck "received" row older than this means every attempt so far failed. */
export const STUCK_AFTER_MS = 15 * 60_000;
/** The Placements "Live" dot shows while a forwarded email arrived within this window. */
export const LIVE_WINDOW_MS = 48 * 3600_000;
/** You get a "no emails" alert after this much silence. */
export const SILENCE_ALERT_MS = 24 * 3600_000;

/** PostgREST filter for emails that came through your forwarding rule (passed the sender checks). */
export const FORWARDED_FILTER = "status.eq.processed,and(status.eq.ignored,reason.neq.wrong_recipient)";

export function throughForwarder(row: Pick<InboundRow, "status" | "reason">): boolean {
  return row.status === "processed" || (row.status === "ignored" && row.reason !== "wrong_recipient");
}

export type IntakeBucket = "added" | "updated" | "noChange" | "ignored" | "rejected" | "attention" | "inProgress";

export function bucketFor(row: InboundRow, now: number): IntakeBucket {
  if (row.status === "quarantined") return "rejected";
  if (row.status === "ignored") return "ignored";
  if (row.status === "processed") {
    if (row.reason === "created") return "added";
    if (row.reason === "updated") return "updated";
    if (row.reason === "ambiguous") return "attention";
    return "noChange";
  }
  // Still "received": either being processed right now, or every attempt so far has failed.
  return now - Date.parse(row.received_at) > STUCK_AFTER_MS ? "attention" : "inProgress";
}

export const REASON_LABELS: Record<string, string> = {
  unknown_forwarder: "Forwarded by someone other than you",
  unauthenticated_forwarder: "Failed ISB sender checks",
  raw_sender_mismatch: "Sender didn't match",
  unparsed_template: "Couldn't read the CAS email format",
  ambiguous: "Matched more than one role at that company",
  wrong_recipient: "Sent to a different address",
};

export function problemLabel(row: InboundRow): string {
  if (row.status === "received") {
    return row.reason?.startsWith("error:") ? `Failed to process (${row.reason.slice(6)})` : "Failed to process";
  }
  return REASON_LABELS[row.reason ?? ""] ?? row.reason ?? "Needs attention";
}

export function intakeSummary(rows: InboundRow[], now: number) {
  const counts: Record<Exclude<IntakeBucket, "inProgress">, number> = {
    added: 0, updated: 0, noChange: 0, ignored: 0, rejected: 0, attention: 0,
  };
  const problems: InboundRow[] = [];
  for (const row of rows) {
    const bucket = bucketFor(row, now);
    if (bucket === "inProgress") continue;
    counts[bucket]++;
    if (bucket === "rejected" || bucket === "attention") problems.push(row);
  }
  problems.sort((a, b) => b.received_at.localeCompare(a.received_at));
  return { counts, problems };
}

export function isLive(lastForwardedAt: string | null, now: number): boolean {
  return !!lastForwardedAt && now - Date.parse(lastForwardedAt) <= LIVE_WINDOW_MS;
}
