import { createFileRoute } from "@tanstack/react-router";

/**
 * Private RSS feed for the owner's 10 PM Outlook automation: one item listing the job
 * applications closing in the next 24 hours, or no items (then no mail goes out).
 * Needs ?key= (see Admin → Job digest feed).
 */
export const Route = createFileRoute("/api/public/job-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jobDigestKeyMatches, readDigestJobs } = await import("@/lib/jobs/digest.server");
        const url = new URL(request.url);
        if (!(await jobDigestKeyMatches(url.searchParams.get("key") ?? ""))) {
          return new Response("Not found", { status: 404 });
        }
        const { digestRss } = await import("@/lib/jobs/digest");
        const now = Date.now();
        const xml = digestRss(await readDigestJobs(now), now, "https://deadlines-isb.lovable.app");
        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
