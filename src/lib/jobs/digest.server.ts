/**
 * The job-digest feed is private: its URL carries a key derived from the server's service
 * key (HMAC), so no extra secret has to be configured. Only the owner sees it (Admin page).
 */
const LABEL = "job-digest-feed-v1";

export async function jobDigestKey(): Promise<string> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new Error("missing_service_key");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(LABEL)));
  return Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function jobDigestKeyMatches(candidate: string): Promise<boolean> {
  const expected = await jobDigestKey();
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

export async function readDigestJobs(now: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Wide window; jobsForDigest picks the exact set (next 24h, or date-only today/tomorrow IST).
  const from = new Date(now - 24 * 3600_000).toISOString();
  const to = new Date(now + 3 * 24 * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, company, role, deadline_at, deadline_date")
    .or(`and(deadline_at.gt.${from},deadline_at.lte.${to}),and(deadline_at.is.null,deadline_date.gte.${from.slice(0, 10)},deadline_date.lte.${to.slice(0, 10)})`);
  if (error) throw new Error("jobs_unavailable");
  return (data ?? []).map((j) => ({ id: j.id, company: j.company, role: j.role, deadlineAt: j.deadline_at, deadlineDate: j.deadline_date }));
}
