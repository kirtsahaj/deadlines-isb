import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPush } from "./webpush.server";

type NewItem = { external_key: string; title: string; due_at: string | null; moodle_course_id: number };

/** Push a "New deadline" alert for each newly discovered upcoming deadline. */
export async function notifyNewDeadlines(userId: string, items: NewItem[]) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return;
  const [{ data: courses }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("courses").select("moodle_course_id, short_name, full_name").eq("user_id", userId),
    supabaseAdmin.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);
  const tz = settings?.timezone ?? "Asia/Kolkata";
  for (const item of items) {
    const course = courses?.find((c) => c.moodle_course_id === item.moodle_course_id);
    const when = new Date(item.due_at!).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz,
    });
    const message = {
      title: `New deadline: ${item.title}`,
      body: `${course ? `${course.short_name || course.full_name} · ` : ""}Due ${when}`,
      url: "/deadlines",
      tag: `new:${item.external_key}`,
    };
    for (const sub of subs) {
      const r = await sendPush(sub, message);
      if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
}
