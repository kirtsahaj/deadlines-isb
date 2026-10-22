import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rosterEnrollments } from "./catalog.server";
import { sectionHintFromTitle, sectionLetter, term5CodeFromShortName } from "./model";

type Row = { external_key: string; kind: string; deadline_type: string; title: string; due_at: string | null; moodle_course_id: number };

/** Only course-level academic deadline metadata is shared: no submissions, calendar user events, grades or identities. */
const SHAREABLE_KINDS = new Set(["assignment", "quiz", "forum", "choice", "text"]);

export async function publishSharedDeadlines(
  userId: string,
  rows: Row[],
  courses: Array<{ id: number; shortname: string | null }>,
) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return;
  const mine = new Map(rosterEnrollments(email).map((e) => [e.courseCode, sectionLetter(e.sectionId)]));
  if (!mine.size) return;
  const codeById = new Map(courses.map((c) => [c.id, term5CodeFromShortName(c.shortname)]));
  const now = new Date().toISOString();
  const payload = rows.flatMap((r) => {
    const code = codeById.get(r.moodle_course_id);
    const section = code ? mine.get(code) : null;
    if (!code || !section || !SHAREABLE_KINDS.has(r.kind)) return [];
    return [{
      course_code: code,
      source_key: r.external_key,
      contributor_section: section,
      section_hint: sectionHintFromTitle(r.title),
      kind: r.kind,
      deadline_type: r.deadline_type,
      title: r.title,
      due_at: r.due_at,
      last_confirmed_at: now,
      active: true,
    }];
  });
  if (payload.length) {
    await supabaseAdmin.from("term5_shared_deadlines").upsert(payload, { onConflict: "course_code,source_key,contributor_section" });
  }
}
