import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PushTarget } from "@/lib/push/webpush.server";
import { sendPush } from "@/lib/push/webpush.server";
import { emailAllowed } from "@/lib/elearn/config.server";
import { planJobReminders } from "./reminders";

/** 12h + 3h job application reminders for every opted-in school account with notifications on. */
export async function sendJobReminders(subs: (PushTarget & { user_id: string })[], now = Date.now()): Promise<number> {
  const horizon = new Date(now + 12 * 60 * 60_000 + 60_000).toISOString();
  const { data: jobs } = await supabaseAdmin.from("jobs").select("id, company, role, deadline_at")
    .gt("deadline_at", new Date(now).toISOString()).lte("deadline_at", horizon);
  if (!jobs?.length) return 0;

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: settings } = await supabaseAdmin.from("user_settings").select("user_id, job_reminders, timezone").in("user_id", userIds);
  const eligible: string[] = [];
  for (const id of userIds) {
    if (settings?.find((s) => s.user_id === id)?.job_reminders === false) continue;
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (emailAllowed(data.user?.email ?? "")) eligible.push(id);
  }

  let sent = 0;
  for (const r of planJobReminders(jobs.map((j) => ({ id: j.id, deadlineAt: j.deadline_at })), eligible, now)) {
    // The primary key (user, job, due time, offset) is the atomic claim: one notice per offset per deadline.
    const { error } = await supabaseAdmin.from("job_reminders").insert({ user_id: r.userId, job_id: r.jobId, due_at: r.dueAt, offset_hours: r.offset });
    if (error) continue;
    const job = jobs.find((j) => j.id === r.jobId)!;
    const tz = settings?.find((s) => s.user_id === r.userId)?.timezone ?? "Asia/Kolkata";
    const when = new Date(r.dueAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
    const message = {
      title: `Applications close ${r.offset === 12 ? "in 12 hours" : "soon"}: ${job.company}`,
      body: `${job.role} · closes ${when} (per CAS email)`,
      url: "/placements",
      tag: `job-${r.jobId}-${r.offset}`,
    };
    for (const sub of subs.filter((s) => s.user_id === r.userId)) {
      const res = await sendPush(sub, message);
      if (res === "sent") sent++;
      if (res === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
  return sent;
}
