import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { campusFor, rosterEnrollments } from "./catalog.server";
import { sectionLetter } from "./model";
import { planSharedPublish } from "./sharePlan";

type Row = { external_key: string; kind: string; deadline_type: string; title: string; due_at: string | null; moodle_course_id: number };

export async function publishSharedDeadlines(
  userId: string,
  rows: Row[],
  courses: Array<{ id: number; shortname: string | null }>,
  options: { complete: boolean } = { complete: false },
) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return;
  const campus = campusFor(email);
  if (!campus) return;
  const mine = new Map(rosterEnrollments(email, campus).map((e) => [e.courseCode, sectionLetter(e.sectionId)]));
  if (!mine.size) return;
  // Only this contributor's own-campus offerings; a Mohali course never feeds Hyderabad and vice versa.
  const now = new Date().toISOString();
  const { payload, scopes } = planSharedPublish(rows, courses, campus, mine, now);
  if (payload.length) {
    const { error } = await supabaseAdmin.from("term5_shared_deadlines").upsert(payload, { onConflict: "course_code,source_key,contributor_section" });
    if (error) return;
  }
  // Like a student's own list, only a complete snapshot may remove anything: items this refresh
  // no longer sees in a section it covers were deleted on eLearn, so stop showing them to classmates.
  // A later sighting by another classmate reactivates the row through the upsert above.
  if (!options.complete) return;
  for (const scope of scopes) {
    await supabaseAdmin
      .from("term5_shared_deadlines")
      .update({ active: false })
      .eq("course_code", scope.course_code)
      .eq("contributor_section", scope.contributor_section)
      .eq("active", true)
      .lt("last_confirmed_at", now);
  }
}
