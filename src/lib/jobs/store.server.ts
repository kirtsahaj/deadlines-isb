import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { JobFacts } from "./merge";
import type { JobStore } from "./pipeline";
import type { ParsedJobEvent } from "./parse";
import { istInstant } from "./parse";

const FINISHED = new Set(["processed", "ignored", "quarantined"]);

type JobRow = {
  id: string; company: string; role: string; company_key: string; role_keys: string[]; role_aliases: string[];
  deadline_date: string | null; deadline_time: string | null; shortlist_date: string | null; field_sent_at: Json;
};

const toFacts = (r: JobRow): JobFacts => ({
  id: r.id, company: r.company, role: r.role, companyKey: r.company_key, roleKeys: r.role_keys, roleAliases: r.role_aliases,
  deadlineDate: r.deadline_date, deadlineTime: r.deadline_time, shortlistDate: r.shortlist_date,
  fieldSentAt: (r.field_sent_at ?? {}) as Record<string, string>,
});

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}_failed`);
  return r.data;
}

/** Server-only persistence for the jobs pipeline. Never logs mail content. */
export function supabaseJobStore(): JobStore {
  let inboundId: string | null = null;
  return {
    async claimInbound(providerId) {
      const ins = await supabaseAdmin.from("job_inbound_messages").insert({ provider_email_id: providerId, attempts: 1 }).select("id").maybeSingle();
      if (!ins.error && ins.data) {
        inboundId = ins.data.id;
        return true;
      }
      const row = must(await supabaseAdmin.from("job_inbound_messages").select("id, status, attempts").eq("provider_email_id", providerId).maybeSingle(), "inbound_read");
      if (!row) throw new Error("inbound_claim_failed");
      if (FINISHED.has(row.status)) return false;
      inboundId = row.id;
      await supabaseAdmin.from("job_inbound_messages").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return true;
    },
    async finishInbound(providerId, status, reason, meta) {
      must(await supabaseAdmin.from("job_inbound_messages").update({
        status, reason, subject: meta?.subject ?? null, original_message_id: meta?.messageId ?? null,
        original_sent_at: meta?.sentAt ?? null, processed_at: new Date().toISOString(),
      }).eq("provider_email_id", providerId), "inbound_finish");
    },
    async insertEvent(e) {
      const r = await supabaseAdmin.from("job_events").insert({
        inbound_id: inboundId!, original_key: e.originalKey, company_key: e.companyKey, company: e.payload.company,
        role: e.payload.role, kind: e.kind, payload: e.payload as unknown as Json, sent_at: e.sentAt,
      }).select("id").maybeSingle();
      if (r.error?.code === "23505") return null;
      return must(r, "event_insert")!.id;
    },
    async jobsForCompany(key) {
      const rows = must(await supabaseAdmin.from("jobs").select("id, company, role, company_key, role_keys, role_aliases, deadline_date, deadline_time, shortlist_date, field_sent_at").eq("company_key", key), "jobs_read");
      return (rows ?? []).map(toFacts);
    },
    async saveJob(job) {
      const now = new Date().toISOString();
      const row = {
        company: job.company, role: job.role, company_key: job.companyKey, role_keys: job.roleKeys, role_aliases: job.roleAliases,
        deadline_date: job.deadlineDate, deadline_time: job.deadlineTime, deadline_at: istInstant(job.deadlineDate, job.deadlineTime),
        shortlist_date: job.shortlistDate, field_sent_at: job.fieldSentAt as Json, last_email_at: now, updated_at: now,
      };
      if (!job.id) return must(await supabaseAdmin.from("jobs").insert(row).select("id").single(), "job_insert").id;
      must(await supabaseAdmin.from("jobs").update(row).eq("id", job.id), "job_update");
      return job.id;
    },
    async pendingEvents(key) {
      const rows = must(await supabaseAdmin.from("job_events").select("id, payload, sent_at").eq("company_key", key).eq("state", "pending"), "pending_read");
      return (rows ?? []).map((r) => ({ id: r.id, payload: r.payload as unknown as ParsedJobEvent, sentAt: r.sent_at }));
    },
    async markEvent(id, state, jobId) {
      must(await supabaseAdmin.from("job_events").update({ state, job_id: jobId }).eq("id", id), "event_mark");
      if (jobId) await supabaseAdmin.from("jobs").update({ last_email_at: new Date().toISOString() }).eq("id", jobId);
    },
    async saveFile(f) {
      const path = `events/${f.eventId}/${f.sha256}.${f.ext}`;
      const up = await supabaseAdmin.storage.from("job-files").upload(path, f.bytes, { contentType: f.mime, upsert: true });
      if (up.error) throw new Error("file_upload_failed");
      must(await supabaseAdmin.from("job_files").insert({
        event_id: f.eventId, storage_path: path, sha256: f.sha256, filename: f.filename, mime: f.mime, size_bytes: f.bytes.length,
      }), "file_insert");
    },
    async linkEventFiles(eventId, jobId) {
      const files = must(await supabaseAdmin.from("job_files").select("id, filename").eq("event_id", eventId), "files_read") ?? [];
      if (!files.length) return;
      await supabaseAdmin.from("job_files").update({ job_id: jobId }).eq("event_id", eventId);
      const pick = files.find((f) => /\b(jd|job|description)\b/i.test(f.filename)) ?? files[0];
      must(await supabaseAdmin.from("jobs").update({ jd_file_id: pick.id }).eq("id", jobId), "jd_link");
    },
  };
}
