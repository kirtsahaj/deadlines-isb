import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPush } from "./webpush.server";
import { withinReminderWindow } from "@/lib/term5/model";

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
  const [{ data: courses }, { data: settings }, { data: rows }] = await Promise.all([
    supabaseAdmin.from("courses").select("moodle_course_id, short_name, full_name").eq("user_id", userId),
    supabaseAdmin.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("deadline_items").select("id, external_key").eq("user_id", userId).in("external_key", items.map((i) => i.external_key)),
  ]);
  const tz = settings?.timezone ?? "Asia/Kolkata";
  for (const item of items) {
    const course = courses?.find((c) => c.moodle_course_id === item.moodle_course_id);
    const courseLabel = course ? course.short_name || course.full_name : "";
    let message;
    if (withinReminderWindow(item.due_at, Date.now())) {
      const id = rows?.find((r) => r.external_key === item.external_key)?.id;
      if (!id) continue;
      const { error } = await supabaseAdmin.from("deadline_notifications").insert({ user_id: userId, deadline_id: id, due_at: item.due_at! });
      if (error) continue;
      const time = new Date(item.due_at!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
      message = { title: `Due at ${time}: ${item.title}`, body: courseLabel || "Open your deadlines", url: "/deadlines", tag: id };
    } else {
      const when = new Date(item.due_at!).toLocaleString("en-IN", {
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
