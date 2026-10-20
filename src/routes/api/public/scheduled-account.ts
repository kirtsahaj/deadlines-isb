import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/scheduled-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
        const { runSync } = await import("@/lib/elearn/sync.server");
        const { keepWorking } = await import("@/lib/background.server");
        const work = runSync(parsed.data.userId, "scheduled").then(async (result) => {
          if (!result.ok) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("sync_queue").update({ locked_at: null, locked_by: null }).eq("user_id", parsed.data.userId);
          }
        });
        if (!keepWorking(work)) await work;
        return Response.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});