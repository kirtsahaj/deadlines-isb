import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduler entry point. Protected by a server-only cron secret; never a
 * browser endpoint. Claims a bounded batch of due connections and runs the
 * same normalization pipeline used by manual sync.
 */
export const Route = createFileRoute("/api/public/scheduled-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncBatchSize } = await import("@/lib/elearn/config.server");
        const { runSync } = await import("@/lib/elearn/sync.server");
        const { keepWorking } = await import("@/lib/background.server");

        const worker = crypto.randomUUID();
        const { data, error } = await supabaseAdmin.rpc("claim_sync_queue", {
          p_worker: worker,
          p_batch: syncBatchSize(),
        });
        if (error) return Response.json({ error: "queue_claim_failed" }, { status: 500 });

        const rows = data ?? [];
        // Each account has its own invocation and six-connection budget.
        // Forward only the already verified scheduler credential, same-origin.
        const target = new URL("/api/public/scheduled-account", request.url);
        const work = Promise.all(rows.map(async (row) => {
          const response = await fetch(target, {
            method: "POST",
            headers: { authorization: request.headers.get("authorization") ?? "", "content-type": "application/json" },
            body: JSON.stringify({ userId: row.user_id }),
          });
          if (!response.ok) {
            await supabaseAdmin.from("sync_queue").update({ locked_at: null, locked_by: null }).eq("user_id", row.user_id).eq("locked_by", worker);
          }
        }));
        if (!keepWorking(work)) await work;
        return Response.json(
          {
            claimed: rows.length,
            queued: rows.length,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
