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
        const { mergedForUser, keyToUuid } = await import("@/lib/term5/userDeadlines.server");
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
              const ids = await Promise.all(item.notifyKeys.map((k) => keyToUuid(userId, k)));
              const { data: done } = await supabaseAdmin
                .from("deadline_notifications")
                .select("deadline_id")
                .eq("user_id", userId)
                .in("deadline_id", ids)
                .eq("due_at", dueAt);
              if (done?.length) continue;
              // Claim every identity first so overlapping runs and merged sources never double-send.
              const { error } = await supabaseAdmin
                .from("deadline_notifications")
                .insert(ids.map((id) => ({ user_id: userId, deadline_id: id, due_at: dueAt })));
              if (error) continue;
              const time = new Date(dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
              const message = {
                title: item.kind === "preread" ? `Preread · class at ${time}: ${item.courseCode}` : `Due at ${time}: ${item.title}`,
                body: item.kind === "preread" ? `${item.preparation?.length ?? 0} readings · ${item.provisional ? "Outline topic estimated · " : ""}${item.classRoom ?? ""}` : item.courseCode,
                url: "/deadlines",
                tag: ids[0],
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
        return Response.json({ sent }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
