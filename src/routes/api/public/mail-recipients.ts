import { createFileRoute } from "@tanstack/react-router";

/**
 * Private RSS feed of BCC lists for Kirt's daily batch mails (?mail=jobs|birthday): one item per
 * campus, opt-outs from /email-settings removed. Same key as the job-digest feed (Admin page).
 */
export const Route = createFileRoute("/api/public/mail-recipients")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jobDigestKeyMatches } = await import("@/lib/jobs/digest.server");
        const url = new URL(request.url);
        if (!(await jobDigestKeyMatches(url.searchParams.get("key") ?? ""))) {
          return new Response("Not found", { status: 404 });
        }
        const mail = url.searchParams.get("mail");
        if (mail !== "jobs" && mail !== "birthday") return new Response("Unknown mail", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("email_unsubscribes").select("email").eq("mail", mail);
        if (error) return new Response("Unavailable", { status: 503 });

        const { rosterEmails } = await import("@/lib/term5/catalog.server");
        const { recipientLists, recipientsRss } = await import("@/lib/mail/recipients");
        const lists = recipientLists(
          [
            { campus: "Mohali", emails: rosterEmails("MOH") },
            { campus: "Hyderabad", emails: rosterEmails("HYD") },
          ],
          (data ?? []).map((r) => r.email),
        );
        return new Response(recipientsRss(mail, lists, Date.now(), "https://deadlines-isb.lovable.app"), {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
