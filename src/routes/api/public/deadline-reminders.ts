import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduler entry: one reminder per merged assessment once it is within 3 hours.
 * Covers own eLearn, shared section updates and outline deadlines with known times.
 */
export const Route = createFileRoute("/api/public/deadline-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push/webpush.server");
        const { mergedForUser } = await import("@/lib/term5/userDeadlines.server");
        const { claimReminder } = await import("@/lib/push/reminderClaims.server");
        const { dueForReminder } = await import("@/lib/term5/model");

        const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
        if (!subs?.length) return Response.json({ sent: 0 });
        const userIds = [...new Set(subs.map((s) => s.user_id))];
        const { data: settings } = await supabaseAdmin.from("user_settings").select("user_id, timezone").in("user_id", userIds);

        let sent = 0;
        const now = Date.now();
        for (const userId of userIds) {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
            const email = u.user?.email ?? "";
            const due = dueForReminder(await mergedForUser(userId, email), now);
            if (!due.length) continue;
            const tz = settings?.find((s) => s.user_id === userId)?.timezone ?? "Asia/Kolkata";
            for (const item of due) {
              const dueAt = item.dueAt;
              if (!dueAt) continue;
              const tag = await claimReminder(userId, item.notifyKeys, dueAt);
              if (!tag) continue;
              const time = new Date(dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
              const message = {
                title: item.kind === "preread" ? `Preread · class at ${time}: ${item.courseCode}` : `Due at ${time}: ${item.title}`,
                body: item.kind === "preread" ? `${item.preparation?.length ?? 0} readings · ${item.provisional ? "Outline topic estimated · " : ""}${item.classRoom ?? ""}` : item.courseCode,
                url: "/deadlines",
                tag,
              };
              for (const sub of subs.filter((s) => s.user_id === userId)) {
                const r = await sendPush(sub, message);
                if (r === "sent") sent++;
                if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
            }
          } catch {
            // One account's failure must not block other reminders.
          }
        }
        let jobSent = 0;
        try {
          const { sendJobReminders } = await import("@/lib/jobs/reminders.server");
          jobSent = await sendJobReminders(subs, now);
        } catch {
          // Job reminders are independent; academic reminders above are already done.
        }
        return Response.json({ sent, jobSent }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
