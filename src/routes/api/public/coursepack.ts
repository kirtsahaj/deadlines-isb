import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams one eLearn file for a signed, 10-minute ticket issued to a signed-in
 * student. The student's own eLearn key is added server-side and never reaches
 * the browser or the URL.
 */
export const Route = createFileRoute("/api/public/coursepack")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifyTicket, userToken, isElearnFile } = await import("@/lib/elearn/coursepack.server");
        const ticket = new URL(request.url).searchParams.get("t") ?? "";
        const p = await verifyTicket(ticket);
        if (!p || !isElearnFile(p.f)) return new Response("Link expired. Go back and tap Coursepack again.", { status: 403 });
        const token = await userToken(p.u);
        if (!token) return new Response("eLearn not connected", { status: 403 });
        const target = new URL(p.f);
        target.pathname = target.pathname.replace("/pluginfile.php/", "/webservice/pluginfile.php/");
        target.searchParams.set("token", token);
        const res = await fetch(target, { redirect: "manual" });
        if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) {
          return new Response("Couldn't open this file from eLearn.", { status: 502 });
        }
        const name = decodeURIComponent(target.pathname.split("/").pop() ?? "coursepack");
        return new Response(res.body, {
          headers: {
            "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
            "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
