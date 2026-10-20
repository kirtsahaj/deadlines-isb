import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduler entry: push one reminder per deadline once it is within 3 hours of its due time. */
export const Route = createFileRoute("/api/public/deadline-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push/webpush.server");
        const { REMINDER_LEAD_MS } = await import("@/lib/push/vapid");

        const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
        if (!subs?.length) return Response.json({ sent: 0 });
        const userIds = [...new Set(subs.map((s) => s.user_id))];

        const now = new Date();
        const { data: items } = await supabaseAdmin
          .from("deadline_items")
          .select("id, user_id, title, due_at, moodle_course_id, submission_status")
          .in("user_id", userIds)
          .eq("active", true)
          .gt("due_at", now.toISOString())
          .lte("due_at", new Date(now.getTime() + REMINDER_LEAD_MS).toISOString());
        const pending = (items ?? []).filter((i) => i.due_at && i.submission_status !== "submitted");
        if (!pending.length) return Response.json({ sent: 0 });

        const { data: done } = await supabaseAdmin
          .from("deadline_notifications")
          .select("deadline_id, due_at")
          .in("deadline_id", pending.map((i) => i.id));
        const doneKeys = new Set((done ?? []).map((d) => `${d.deadline_id}|${new Date(d.due_at).getTime()}`));

        const { data: courses } = await supabaseAdmin
          .from("courses").select("user_id, moodle_course_id, short_name, full_name").in("user_id", userIds);
        const { data: settings } = await supabaseAdmin.from("user_settings").select("user_id, timezone").in("user_id", userIds);

        let sent = 0;
        for (const item of pending) {
          const due = new Date(item.due_at!);
          if (doneKeys.has(`${item.id}|${due.getTime()}`)) continue;
          // Claim first so overlapping runs never double-send.
          const { error } = await supabaseAdmin.from("deadline_notifications").insert({ user_id: item.user_id, deadline_id: item.id, due_at: item.due_at! });
          if (error) continue;
          const course = courses?.find((c) => c.user_id === item.user_id && c.moodle_course_id === item.moodle_course_id);
          const tz = settings?.find((s) => s.user_id === item.user_id)?.timezone ?? "Asia/Kolkata";
          const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
          const message = {
            title: `Due at ${time}: ${item.title}`,
            body: course ? (course.short_name || course.full_name) : "Open your deadlines",
            url: "/deadlines",
            tag: item.id,
          };
          for (const sub of subs.filter((s) => s.user_id === item.user_id)) {
            const r = await sendPush(sub, message);
            if (r === "sent") sent++;
            if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
        return Response.json({ sent }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
