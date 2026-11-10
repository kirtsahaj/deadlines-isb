import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { PushTarget } from "@/lib/push/webpush.server";
import { sendPush } from "@/lib/push/webpush.server";
import { claimReminder } from "@/lib/push/reminderClaims.server";
import { isAdminEmail } from "@/lib/admin";
import { companyKey, roleKey } from "./merge";
import { istInstant } from "./parse";
import {
  changeSummary,
  deadlineLabel,
  parsePortalRows,
  planPortalSync,
  portalDay,
  portalSlot,
  tidy,
  type AppJob,
  type PortalJob,
} from "./portal";

/**
 * Daily portal check (see ./portal for the rules). One read-only request to the portal's active job list,
 * using the owner's HireTrack token (secret HIRETRACK_TOKEN). Only company, role and deadline are kept.
 * Silent for everyone except the owner, who gets one push when the list changed or the check failed.
 */
const ACTIVE_URL = "https://placements.isb.edu/ssms/api/sk-applications/student/active";
const LIST_BODY = '{"company":"0","daySlot":"0","groupFunction":"0","industryGroup":"0","jobDaySlot":"0","jobStatus":"0","jobTitle":"0","sortBy":"0"}';

export type PortalFailure = "no_token" | "token_rejected" | "portal_unreachable" | "unexpected_response";
export const FAILURE_TEXT: Record<PortalFailure, string> = {
  no_token: "No portal token saved",
  token_rejected: "Token not accepted (expired, revoked or logged out)",
  portal_unreachable: "Portal could not be reached",
  unexpected_response: "Portal answered in an unexpected format",
};

class CheckError extends Error {
  constructor(readonly code: PortalFailure) {
    super(code);
  }
}

async function readActive(): Promise<PortalJob[]> {
  const token = (process.env["HIRETRACK_TOKEN"] ?? "").trim();
  if (!token || /\s/.test(token)) throw new CheckError("no_token");
  let res: Response;
  try {
    res = await fetch(ACTIVE_URL, {
      method: "POST",
      redirect: "manual",
      headers: { Authorization: `Bearer ${token}`, "x-access-token": token, Accept: "application/json", "Content-Type": "application/json" },
      body: LIST_BODY,
    });
  } catch {
    throw new CheckError("portal_unreachable");
  }
  if (res.status === 401 || res.status === 403) throw new CheckError("token_rejected");
  if (!res.ok) throw new CheckError(res.status >= 500 ? "portal_unreachable" : "unexpected_response");
  let payload: Record<string, unknown>;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new CheckError("unexpected_response");
  }
  if (payload["entityName"] === "tokenexpired" || payload["errorKey"] === "token_expired") throw new CheckError("token_rejected");
  const rows = payload["applicationDetails"];
  if (!Array.isArray(rows) || rows.length > 5000) throw new CheckError("unexpected_response");
  if (["next", "nextPage", "next_cursor", "has_more"].some((k) => payload[k])) throw new CheckError("unexpected_response");
  const { jobs, invalid } = parsePortalRows(rows);
  // A list that is mostly unreadable means the format changed: stop rather than act on it.
  if (rows.length && invalid > rows.length / 2) throw new CheckError("unexpected_response");
  return jobs;
}

async function ownerTargets(subs: (PushTarget & { user_id: string })[]) {
  for (const id of [...new Set(subs.map((s) => s.user_id))]) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (isAdminEmail(data.user?.email)) return { ownerId: id, targets: subs.filter((s) => s.user_id === id) };
  }
  return null;
}

async function pushOwner(subs: (PushTarget & { user_id: string })[], claimKey: string, dueAt: string, message: { title: string; body: string }) {
  const owner = await ownerTargets(subs);
  if (!owner || !(await claimReminder(owner.ownerId, [claimKey], dueAt))) return;
  for (const sub of owner.targets) {
    const r = await sendPush(sub, { ...message, url: "/admin/portal", tag: claimKey });
    if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
}

type JobRowLite = {
  id: string; company: string; role: string; role_keys: string[]; deadline_date: string | null; deadline_time: string | null;
  portal_id: string | null; hidden_at: string | null;
};

/** Runs the reading due now (8 PM or 9 PM IST), once per day per slot. Safe to call every 15 minutes. */
export async function runPortalCheck(subs: (PushTarget & { user_id: string })[], now = Date.now()): Promise<string> {
  const slot = portalSlot(now);
  if (!slot) return "not_due";
  const day = portalDay(now);
  const { data: done } = await supabaseAdmin.from("portal_check_runs").select("id").eq("day", day).eq("slot", slot).eq("ok", true).limit(1);
  if (done?.length) return "done";

  let active: PortalJob[];
  try {
    active = await readActive();
  } catch (e) {
    const code: PortalFailure = e instanceof CheckError ? e.code : "unexpected_response";
    await supabaseAdmin.from("portal_check_runs").insert({ day, slot, ok: false, error: code });
    // Log and alert once per day; later ticks in the same hour retry quietly.
    const { count } = await supabaseAdmin.from("portal_job_changes").select("id", { count: "exact", head: true })
      .eq("action", "failed").gte("created_at", new Date(`${day}T00:00:00+05:30`).toISOString());
    if (!count) {
      await supabaseAdmin.from("portal_job_changes").insert({ action: "failed", note: `${slot === "8pm" ? "8 PM" : "9 PM"} check: ${FAILURE_TEXT[code]}` });
    }
    await pushOwner(subs, `portal-failed:${day}`, new Date(`${day}T20:00:00+05:30`).toISOString(), {
      title: "Portal check failed",
      body: FAILURE_TEXT[code],
    });
    return `failed:${code}`;
  }

  const snapshot = active.map((p) => ({ p: p.portalId, c: p.company, r: p.role, d: `${p.deadlineDate} ${p.deadlineTime}` }));
  // The ok row is the claim: a unique index allows one per day and slot.
  const claim = await supabaseAdmin.from("portal_check_runs")
    .insert({ day, slot, ok: true, active_count: active.length, snapshot: snapshot as unknown as Json }).select("id").maybeSingle();
  if (claim.error || !claim.data) return "done";
  if (slot === "8pm") return "read";

  const { data: earlier } = await supabaseAdmin.from("portal_check_runs").select("snapshot")
    .eq("day", day).eq("slot", "8pm").eq("ok", true).maybeSingle();
  const at8 = Array.isArray(earlier?.snapshot)
    ? (earlier!.snapshot as { p: string; c: string; r: string; d: string }[]).map((s) => ({
        portalId: s.p, company: s.c, role: s.r, deadlineDate: s.d.slice(0, 10), deadlineTime: s.d.slice(11),
      }))
    : null;

  const { data: rows, error } = await supabaseAdmin.from("jobs")
    .select("id, company, role, role_keys, deadline_date, deadline_time, portal_id, hidden_at").limit(5000);
  if (error) throw new Error("jobs_read_failed");
  const app: AppJob[] = ((rows ?? []) as JobRowLite[]).map((r) => ({
    id: r.id, company: r.company, role: r.role, roleKeys: r.role_keys ?? [], deadlineDate: r.deadline_date, deadlineTime: r.deadline_time,
    portalId: r.portal_id, hidden: !!r.hidden_at,
  }));
  const byId = new Map(app.map((a) => [a.id, a]));
  const plan = planPortalSync(app, active, at8, now);
  const stamp = new Date(now).toISOString();
  const log: { action: string; job_id?: string | null; portal_id?: string | null; company: string; role: string; old_deadline?: string | null; new_deadline?: string | null; note?: string | null }[] = [];

  for (const l of plan.link) await supabaseAdmin.from("jobs").update({ portal_id: l.portalId }).eq("id", l.jobId);
  if (plan.seen.length) await supabaseAdmin.from("jobs").update({ portal_seen_at: stamp }).in("id", plan.seen);

  for (const p of plan.add) {
    const ins = await supabaseAdmin.from("jobs").insert({
      company: p.company, role: p.role, company_key: companyKey(p.company), role_keys: [roleKey(p.role)], role_aliases: [],
      deadline_date: p.deadlineDate, deadline_time: p.deadlineTime, deadline_at: istInstant(p.deadlineDate, p.deadlineTime),
      portal_id: p.portalId, portal_seen_at: stamp, updated_at: stamp,
    }).select("id").maybeSingle();
    if (ins.error) continue;
    log.push({ action: "added", job_id: ins.data?.id ?? null, portal_id: p.portalId, company: p.company, role: p.role, new_deadline: deadlineLabel(p.deadlineDate, p.deadlineTime) });
  }
  for (const d of plan.deadline) {
    const a = byId.get(d.jobId)!;
    await supabaseAdmin.from("jobs").update({
      deadline_date: d.to.deadlineDate, deadline_time: d.to.deadlineTime, deadline_at: istInstant(d.to.deadlineDate, d.to.deadlineTime), updated_at: stamp,
    }).eq("id", d.jobId);
    log.push({ action: "deadline", job_id: d.jobId, portal_id: d.to.portalId, company: tidy(a.company), role: tidy(a.role), old_deadline: d.from, new_deadline: deadlineLabel(d.to.deadlineDate, d.to.deadlineTime) });
  }
  for (const h of plan.hide) {
    const a = byId.get(h.jobId)!;
    await supabaseAdmin.from("jobs").update({ hidden_at: stamp }).eq("id", h.jobId);
    log.push({ action: "hidden", job_id: h.jobId, portal_id: a.portalId, company: tidy(a.company), role: tidy(a.role), old_deadline: deadlineLabel(a.deadlineDate, a.deadlineTime), note: "No longer on the portal's active list (8 PM and 9 PM)" });
  }
  for (const u of plan.unhide) {
    const a = byId.get(u.jobId)!;
    await supabaseAdmin.from("jobs").update({ hidden_at: null }).eq("id", u.jobId);
    log.push({ action: "unhidden", job_id: u.jobId, portal_id: a.portalId, company: tidy(a.company), role: tidy(a.role), note: "Back on the portal" });
  }
  // PPO/PPI skips are logged once per posting.
  if (plan.skipped.length) {
    const { data: already } = await supabaseAdmin.from("portal_job_changes").select("portal_id").eq("action", "skipped")
      .in("portal_id", plan.skipped.map((p) => p.portalId));
    const seen = new Set((already ?? []).map((r) => r.portal_id));
    for (const p of plan.skipped) {
      if (!seen.has(p.portalId)) {
        log.push({ action: "skipped", portal_id: p.portalId, company: p.company, role: p.role, new_deadline: deadlineLabel(p.deadlineDate, p.deadlineTime), note: "PPO/PPI-only posting" });
      }
    }
  }
  if (log.length) await supabaseAdmin.from("portal_job_changes").insert(log);

  const title = changeSummary(plan);
  if (title) {
    await pushOwner(subs, `portal-changes:${day}`, new Date(`${day}T21:00:00+05:30`).toISOString(), { title, body: "Tap to see the change log" });
  }
  return `applied:${plan.add.length}/${plan.deadline.length}/${plan.hide.length}/${plan.unhide.length}`;
}
