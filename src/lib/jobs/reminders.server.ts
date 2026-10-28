import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PushTarget } from "@/lib/push/webpush.server";
import { sendPush } from "@/lib/push/webpush.server";
import { emailAllowed } from "@/lib/elearn/config.server";
import { jobAlertsOn, planJobReminders } from "./reminders";

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

/** 12-hour and 3-hour job application reminders for every school account with device notifications on. */
export async function sendJobReminders(subs: (PushTarget & { user_id: string })[], now = Date.now()): Promise<number> {
  const horizon = new Date(now + 12 * 60 * 60_000 + 60_000).toISOString();
  const { data: jobs } = await supabaseAdmin.from("jobs").select("id, company, role, deadline_at")
    .gt("deadline_at", new Date(now).toISOString()).lte("deadline_at", horizon);
  if (!jobs?.length) return 0;

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: settings } = await supabaseAdmin.from("user_settings").select("user_id, timezone").in("user_id", userIds);
  const eligible = await eligibleUsers(userIds);

  let sent = 0;
  for (const r of planJobReminders(jobs.map((j) => ({ id: j.id, deadlineAt: j.deadline_at })), eligible, now)) {
    // The primary key (user, job, due time, offset) is the atomic claim: one notice per deadline.
    const { error } = await supabaseAdmin.from("job_reminders").insert({ user_id: r.userId, job_id: r.jobId, due_at: r.dueAt, offset_hours: r.offset });
    if (error) continue;
    const job = jobs.find((j) => j.id === r.jobId)!;
    const tz = settings?.find((s) => s.user_id === r.userId)?.timezone ?? "Asia/Kolkata";
    const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
    // The 12-hour notice can land the evening before: say "tomorrow" so the time isn't misread as today.
    const day = dayOf(Date.parse(r.dueAt)) === dayOf(now) ? "" : "tomorrow ";
    const time = day + new Date(r.dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
    const message = { title: `Apply by ${time}: ${job.company}`, body: job.role ?? "Open Placements", url: "/placements", tag: `job-${r.jobId}-${r.offset}` };
    for (const sub of subs.filter((s) => s.user_id === r.userId)) {
      const res = await sendPush(sub, message);
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
