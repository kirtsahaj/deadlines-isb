import { createFileRoute } from "@tanstack/react-router";

/**
 * Resend "email.received" webhook for the Placements feed.
 * Verifies the Svix signature over the raw bytes, then fetches the message from Resend itself.
 * Responds with no mail data. Non-2xx only for transient failures so Resend retries.
 * Secrets are read per request; the hosted preview picks up newly saved secrets on its next build.
 */
export const Route = createFileRoute("/api/public/resend-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = new Uint8Array(await request.arrayBuffer());
        if (raw.length > 256 * 1024) return new Response("too large", { status: 413 });

        const { verifySvix } = await import("@/lib/jobs/svix");
        const ok = await verifySvix(secret, {
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
          signature: request.headers.get("svix-signature"),
        }, raw);
        if (!ok) return new Response("invalid signature", { status: 401 });

        let event: { type?: string; data?: { email_id?: string; to?: string[] } };
        try {
          event = JSON.parse(new TextDecoder().decode(raw));
        } catch {
          return new Response("bad payload", { status: 400 });
        }
        if (event.type !== "email.received") return Response.json({ ok: true, skipped: true });
        const emailId = event.data?.email_id ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(emailId)) return new Response("bad payload", { status: 400 });

        try {
          const { fetchReceivedEmail } = await import("@/lib/jobs/resend.server");
          const { supabaseJobStore } = await import("@/lib/jobs/store.server");
          const { ingestConfig } = await import("@/lib/jobs/config.server");
          const { ingest } = await import("@/lib/jobs/pipeline");
          const input = await fetchReceivedEmail(emailId);
          const result = await ingest(supabaseJobStore(), input, ingestConfig());
          console.log(`[placements] ${result.status}: ${result.reason}`);
          if (result.newJob) {
            const { newJobWorthAnnouncing } = await import("@/lib/jobs/reminders");
            if (newJobWorthAnnouncing(result.newJob.deadline, Date.now())) {
              try {
                const { notifyNewJob } = await import("@/lib/jobs/reminders.server");
                await notifyNewJob(result.newJob);
              } catch {
                // Alerts are best-effort; the job is already saved.
              }
            }
          }
          return Response.json({ ok: true });
        } catch (error) {
          if (error instanceof Error && error.message === "in_progress") return new Response("in progress, retry", { status: 503 });
          console.error(`[placements] intake failed: ${error instanceof Error ? error.message : "unknown"}`);
          return new Response("retry", { status: 500 });
        }
      },
    },
  },
});
