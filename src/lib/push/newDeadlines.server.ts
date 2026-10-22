import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPush } from "./webpush.server";
import { withinReminderWindow } from "@/lib/term5/model";
import { mergedForUser } from "@/lib/term5/userDeadlines.server";
import { claimReminder } from "./reminderClaims.server";

type NewItem = { external_key: string; title: string; due_at: string | null; moodle_course_id: number };

/**
 * Push a "New deadline" alert for each newly discovered upcoming deadline.
 * If it is already inside the 3-hour window, send the reminder instead (once) and
 * record it so the reminder schedule does not repeat it.
 */
export async function notifyNewDeadlines(userId: string, items: NewItem[]) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return;
  const [{ data: account }, { data: settings }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);
  const tz = settings?.timezone ?? "Asia/Kolkata";
  const merged = await mergedForUser(userId, account.user?.email ?? "");
  const seen = new Set<string>();
  for (const item of items) {
    const deadline = merged.find(d => d.own?.external_key === item.external_key);
    const dueAt = deadline?.dueAt;
    if (!deadline || !dueAt || deadline.submissionStatus === "submitted" || seen.has(deadline.id)) continue;
    seen.add(deadline.id);
    const courseLabel = deadline.courseCode;
    let message;
    if (withinReminderWindow(dueAt, Date.now())) {
      if (!deadline.remindable) continue;
      const tag = await claimReminder(userId, deadline.notifyKeys, dueAt);
      if (!tag) continue;
      const time = new Date(dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
      message = { title: `Due at ${time}: ${item.title}`, body: courseLabel || "Open your deadlines", url: "/deadlines", tag };
    } else {
      const when = new Date(dueAt).toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz,
      });
      message = {
        title: `New deadline: ${item.title}`,
        body: `${courseLabel ? `${courseLabel} · ` : ""}Due ${when}`,
        url: "/deadlines",
        tag: `new:${item.external_key}`,
      };
    }
    for (const sub of subs) {
      const r = await sendPush(sub, message);
      if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
}
