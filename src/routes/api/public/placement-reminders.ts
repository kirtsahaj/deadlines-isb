import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduler entry for Placements only: daily job summaries at 10 PM and 8 AM IST, plus the 8 PM/9 PM portal check (src/lib/jobs/reminders). Separate from academic reminders. */
export const Route = createFileRoute("/api/public/placement-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendJobReminders } = await import("@/lib/jobs/reminders.server");
        const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
        // Daily portal check (8 PM and 9 PM IST) runs first so the 10 PM mail and summary include its changes.
        let portal = "skipped";
        try {
          const { runPortalCheck } = await import("@/lib/jobs/portal.server");
          portal = await runPortalCheck(subs ?? []);
        } catch {
          portal = "error";
        }
        if (!subs?.length) return Response.json({ sent: 0, portal });
        const sent = await sendJobReminders(subs);
        let intakeAlerts = 0;
        try {
          const { alertOwnerAboutIntake } = await import("@/lib/jobs/intakeAlerts.server");
          intakeAlerts = await alertOwnerAboutIntake(subs);
        } catch {
          // Owner health alerts are best-effort and never block job reminders.
        }
        return Response.json({ sent, intakeAlerts, portal });
      },
    },
  },
});
