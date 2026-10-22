import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { courseTitles, resolveEnrollments, term5Catalog, type Override } from "./catalog.server";
import { mergeDeadlines, type Enrollment, type OutlineOccurrence, type SharedRow, type UnifiedDeadline } from "./model";

const SHARED_MAX_AGE_MS = 14 * 86400_000;

export async function enrollmentsFor(userId: string, email: string) {
  const { data } = await supabaseAdmin
    .from("term5_enrollment_overrides")
    .select("course_code, section_id, removed")
    .eq("user_id", userId);
  return resolveEnrollments(email, (data ?? []) as Override[]);
}

export async function sharedFor(enrollments: Enrollment[]): Promise<SharedRow[]> {
  const codes = enrollments.map((e) => e.courseCode);
  if (!codes.length) return [];
  const { data } = await supabaseAdmin
    .from("term5_shared_deadlines")
    .select("id, course_code, source_key, contributor_section, section_hint, kind, deadline_type, title, due_at, last_confirmed_at")
    .in("course_code", codes)
    .eq("active", true)
    .gt("last_confirmed_at", new Date(Date.now() - SHARED_MAX_AGE_MS).toISOString());
  return (data ?? []) as SharedRow[];
}

/** Server-side merged view used by reminders, identical to what the student sees. */
export async function mergedForUser(userId: string, email: string): Promise<UnifiedDeadline[]> {
  const { enrollments } = await enrollmentsFor(userId, email);
  const [{ data: own }, { data: courses }, { data: conn }, shared] = await Promise.all([
    supabaseAdmin
      .from("deadline_items")
      .select("id, external_key, title, kind, deadline_type, deadline_status, submission_status, due_at, conflict, moodle_course_id, source_primary")
      .eq("user_id", userId)
      .eq("active", true),
    supabaseAdmin.from("courses").select("moodle_course_id, short_name, full_name").eq("user_id", userId),
    supabaseAdmin.from("elearn_connections").select("last_success_at").eq("user_id", userId).maybeSingle(),
    sharedFor(enrollments),
  ]);
  return mergeDeadlines({
    now: Date.now(),
    enrollments,
    courseTitles: courseTitles(),
    outline: term5Catalog.occurrences as OutlineOccurrence[],
    own: own ?? [],
    ownCourses: courses ?? [],
    ownLastSuccessAt: conn?.last_success_at ?? null,
    shared,
  });
}

/** Deterministic UUID for notification dedupe of non-eLearn keys. */
export async function keyToUuid(userId: string, key: string): Promise<string> {
  if (/^[0-9a-f-]{36}$/i.test(key)) return key;
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}|${key}`)));
  const h = [...buf.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
