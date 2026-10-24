import type { InboundInput } from "./pipeline";
import { htmlToText } from "./mime";

const MAX_RAW_BYTES = 25 * 1024 * 1024;
const API = "https://api.resend.com";

type Received = {
  to?: string[];
  received_for?: string[];
  from?: string;
  subject?: string;
  text?: string | null;
  html?: string | null;
  /** Verdicts computed by Resend's receiving server (present on GET /emails/receiving/:id, observed live). */
  authentication?: { spf?: string; dkim?: string; dmarc?: string } | null;
  raw?: { download_url?: string } | null;
};

/** Raw source comes only from Resend's own signed download host; mail-supplied URLs are never fetched. */
function trustedRawUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    // Observed live: Resend serves raw MIME from cdn.resend.app with a signed, expiring URL.
    const ok = u.protocol === "https:" && host === "cdn.resend.app";
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_RAW_BYTES || !res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RAW_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export async function fetchReceivedEmail(emailId: string): Promise<InboundInput> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("resend_key_missing");
  const res = await fetch(`${API}/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`resend_fetch_failed_${res.status}`);
  }
  const data = (await res.json()) as Received;

  let raw: Uint8Array | null = null;
  const rawUrl = trustedRawUrl(data.raw?.download_url);
  if (rawUrl) {
    // Workers only support "follow"/"manual"; "manual" plus an exact 200 still refuses any redirect.
    const rawRes = await fetch(rawUrl, { redirect: "manual" });
    if (rawRes.status === 200) raw = await readCapped(rawRes);
    else await rawRes.body?.cancel();
  }

  // Without the stored raw MIME we cannot see attachments or verify the forward; retry rather than guess.
  if (!raw) throw new Error("raw_unavailable");

  return {
    providerId: emailId,
    to: data.to ?? [],
    receivedFor: data.received_for ?? [],
    from: data.from ?? "",
    auth: data.authentication ?? null,
    raw,
    fallback: { subject: data.subject ?? "", text: data.text?.trim() ? data.text : htmlToText(data.html ?? "") },
  };
}
