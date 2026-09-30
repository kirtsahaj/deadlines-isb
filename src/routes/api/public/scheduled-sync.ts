import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduler entry point. Protected by a server-only cron secret; never a
 * browser endpoint. Claims a bounded batch of due connections and runs the
 * same normalization pipeline used by manual sync.
 */
export const Route = createFileRoute("/api/public/scheduled-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!expected) {
          return Response.json({ error: "server_configuration" }, { status: 500 });
        }
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
        if (!timingSafeEqual(digest(provided), digest(expected))) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncBatchSize, syncConcurrency } = await import("@/lib/elearn/config.server");
        const { runSync } = await import("@/lib/elearn/sync.server");

        const worker = crypto.randomUUID();
        const { data, error } = await supabaseAdmin.rpc("claim_sync_queue", {
          p_worker: worker,
          p_batch: syncBatchSize(),
        });
        if (error) return Response.json({ error: "queue_claim_failed" }, { status: 500 });

        const rows = data ?? [];
        const concurrency = syncConcurrency();
        const results: boolean[] = [];
        for (let i = 0; i < rows.length; i += concurrency) {
          const batch = await Promise.all(
            rows
              .slice(i, i + concurrency)
              .map(async (row) => (await runSync(row.user_id, "scheduled")).ok),
          );
          results.push(...batch);
        }
        return Response.json(
          {
            claimed: rows.length,
            succeeded: results.filter(Boolean).length,
            failed: results.filter((ok) => !ok).length,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
