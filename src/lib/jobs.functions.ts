import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSchoolUser(claims: unknown) {
  const { emailAllowed } = await import("./elearn/config.server");
  const email = (claims as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string" || !emailAllowed(email.toLowerCase().trim())) throw new Error("email_domain_not_allowed");
}

export type JobTile = {
  id: string;
  company: string;
  role: string;
  deadlineDate: string | null;
  deadlineTime: string | null;
  deadlineAt: string | null;
  shortlistDate: string | null;
  hasJd: boolean;
  updatedAt: string;
  /** When the original CAS email was sent (falls back to when the app first saw the job). */
  addedAt: string;
  starred: boolean;
};

/** Sanitized job facts only: no source mail, senders, links or owner details. */
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [jobs, stars, setting, events] = await Promise.all([
      supabaseAdmin.from("jobs").select("id, company, role, deadline_date, deadline_time, deadline_at, shortlist_date, jd_file_id, last_email_at, first_seen_at").is("hidden_at", null).limit(1000),
      context.supabase.from("job_stars").select("job_id"),
      supabaseAdmin.from("user_settings").select("job_reminders").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("job_events").select("job_id, sent_at").not("job_id", "is", null).limit(10000),
    ]);
    const { FORWARDED_FILTER } = await import("./jobs/intake");
    const { data: lastForwarded } = await supabaseAdmin.from("job_inbound_messages").select("received_at").or(FORWARDED_FILTER)
      .order("received_at", { ascending: false }).limit(1).maybeSingle();
    if (jobs.error) throw new Error("jobs_unavailable");
    const starred = new Set((stars.data ?? []).map((s) => s.job_id));
    const firstEmail = new Map<string, string>();
    for (const e of events.data ?? []) {
      if (!e.job_id) continue;
      const prev = firstEmail.get(e.job_id);
      if (!prev || e.sent_at < prev) firstEmail.set(e.job_id, e.sent_at);
    }
    const tiles: JobTile[] = (jobs.data ?? []).map((j) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      deadlineDate: j.deadline_date,
      deadlineTime: j.deadline_time,
      deadlineAt: j.deadline_at,
      shortlistDate: j.shortlist_date,
      hasJd: !!j.jd_file_id,
      updatedAt: j.last_email_at,
      addedAt: firstEmail.get(j.id) ?? j.first_seen_at,
      starred: starred.has(j.id),
    }));
    const feedUpdatedAt = tiles.reduce<string | null>((max, t) => (!max || t.updatedAt > max ? t.updatedAt : max), null);
    const lastNewPostingAt = tiles.reduce<string | null>((max, t) => (!max || t.addedAt > max ? t.addedAt : max), null);
    return {
      jobs: tiles,
      feedUpdatedAt,
      lastNewPostingAt,
      /** Last email that came through the owner's forward: the feed's heartbeat. */
      lastForwardedAt: lastForwarded?.received_at ?? null,
      jobReminders: setting.data?.job_reminders ?? true,
    };
  });

export const setJobStar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), starred: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSchoolUser(context.claims);
    if (data.starred) {
      const { error } = await context.supabase.from("job_stars").upsert({ user_id: context.userId, job_id: data.jobId }, { onConflict: "user_id,job_id", ignoreDuplicates: true });
      if (error) throw new Error("star_failed");
    } else {
      await context.supabase.from("job_stars").delete().eq("job_id", data.jobId).eq("user_id", context.userId);
    }
    return { ok: true };
  });

/** A 60-second download link, minted only for a signed-in school account. */
export const getJobJdLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin.from("jobs").select("jd_file_id").eq("id", data.jobId).maybeSingle();
    if (!job?.jd_file_id) throw new Error("jd_not_available");
    const { data: file } = await supabaseAdmin.from("job_files").select("storage_path, filename").eq("id", job.jd_file_id).maybeSingle();
    if (!file) throw new Error("jd_not_available");
    const { data: signed, error } = await supabaseAdmin.storage.from("job-files").createSignedUrl(file.storage_path, 60, { download: file.filename });
    if (error || !signed) throw new Error("jd_not_available");
    return { url: signed.signedUrl };
  });

export const setJobReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_settings").update({ job_reminders: data.enabled }).eq("user_id", context.userId);
    if (error) throw new Error("setting_failed");
    return { ok: true };
  });
