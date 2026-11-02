import { createFileRoute } from "@tanstack/react-router";

/**
 * Private RSS feed for the morning Birthday reminder mail: one item per campus with a birthday
 * today or coming up (title = subject, description = HTML body); none on quiet days.
 * Same key as the job-digest feed. BCC lists come from /api/public/mail-recipients?mail=birthday.
 */
export const Route = createFileRoute("/api/public/birthday-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jobDigestKeyMatches } = await import("@/lib/jobs/digest.server");
        if (!(await jobDigestKeyMatches(new URL(request.url).searchParams.get("key") ?? ""))) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [people, hidden] = await Promise.all([
          supabaseAdmin.from("birthdays").select("email, name, campus, month, day"),
          supabaseAdmin.from("email_unsubscribes").select("email").eq("mail", "hide_birthday"),
        ]);
        if (people.error || hidden.error) return new Response("Unavailable", { status: 503 });

        const { birthdayMail, birthdayRss } = await import("@/lib/mail/birthdays");
        const now = Date.now();
        const app = "https://deadlines-isb.lovable.app";
        const rows = (people.data ?? []) as Parameters<typeof birthdayMail>[1];
        const hiddenEmails = (hidden.data ?? []).map((r) => r.email);
        const mails = (["Mohali", "Hyderabad"] as const)
          .map((c) => birthdayMail(c, rows, hiddenEmails, now, app))
          .filter((m) => m !== null);
        return new Response(birthdayRss(mails, now, app), {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
