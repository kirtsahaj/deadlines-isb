import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PushTarget } from "@/lib/push/webpush.server";
import { sendPush } from "@/lib/push/webpush.server";
import { emailAllowed } from "@/lib/elearn/config.server";
import { claimReminder } from "@/lib/push/reminderClaims.server";
import { dueJobSummary, jobAlertsOn, jobSummaryClaim, jobSummaryMessage } from "./reminders";

/** School accounts that haven't turned job alerts off with the Placements bell. */
async function eligibleUsers(userIds: string[]): Promise<string[]> {
  const { data: settings, error } = await supabaseAdmin.from("user_settings").select("user_id, job_reminders").in("user_id", userIds);
  if (error) throw new Error("settings_read_failed");
  const out: string[] = [];
  for (const id of jobAlertsOn(userIds, settings ?? [])) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (emailAllowed(data.user?.email ?? "")) out.push(id);
  }
  return out;
}

/**
 * Daily job summaries (10 PM and 8 AM IST, see ./reminders) for every school account with
 * device notifications on and the Placements bell on. Claimed once per user, kind and day.
 */
export async function sendJobReminders(subs: (PushTarget & { user_id: string })[], now = Date.now()): Promise<number> {
  const kind = dueJobSummary(now);
  if (!kind) return 0;
  const { readDigestJobs } = await import("./digest.server");
  const message = jobSummaryMessage(kind, await readDigestJobs(now), now);
  if (!message) return 0;

  const eligible = await eligibleUsers([...new Set(subs.map((s) => s.user_id))]);
  const claim = jobSummaryClaim(kind, now);
  let sent = 0;
  for (const userId of eligible) {
    const tag = await claimReminder(userId, [claim.key], claim.dueAt);
    if (!tag) continue;
    for (const sub of subs.filter((s) => s.user_id === userId)) {
      const res = await sendPush(sub, { ...message, url: "/placements", tag: `${claim.key}-${claim.dueAt.slice(0, 10)}` });
      if (res === "sent") sent++;
      if (res === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
  return sent;
}

/** Instant "new job" alert to every school account with device notifications on. */
export async function notifyNewJob(job: { company: string; role: string | null; deadline?: { date?: string; time?: string } | undefined }): Promise<number> {
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  if (!subs?.length) return 0;
  const eligible = new Set(await eligibleUsers([...new Set(subs.map((s) => s.user_id))]));
  const when = job.deadline?.date
    ? ` · apply by ${new Date(`${job.deadline.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}${job.deadline.time ? ` ${job.deadline.time}` : ""}`
    : "";
  const message = { title: `New job: ${job.company}`, body: `${job.role ?? "New role"}${when}`, url: "/placements", tag: `newjob-${job.company}-${job.role ?? ""}`.slice(0, 120) };
  let sent = 0;
  for (const sub of subs.filter((s) => eligible.has(s.user_id))) {
    const res = await sendPush(sub, message);
    if (res === "sent") sent++;
    if (res === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
  return sent;
}
