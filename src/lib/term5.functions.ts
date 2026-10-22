import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function claimEmail(claims: unknown): string {
  const v = (claims as { email?: unknown } | undefined)?.email;
  return typeof v === "string" ? v.toLowerCase().trim() : "";
}

async function allowedEmail(claims: unknown) {
  const { emailAllowed } = await import("./elearn/config.server");
  const email = claimEmail(claims);
  if (!emailAllowed(email)) throw new Error("email_domain_not_allowed");
  return email;
}

export type PrepItem = {
  id: string;
  title: string;
  kind: string;
  requirement: string;
  timing: string;
  alsoFor: string[];
  note: string | null;
};
export type ScheduleClass = {
  id: string;
  courseCode: string;
  courseName: string;
  section: string;
  startsAt: string;
  endsAt: string;
  room: string;
  sessionTitle: string | null;
  sessionLabels: string[];
  mapping: string;
  sourceKind: string | null;
  prep: PrepItem[];
};

/** The student's Term 5 plan: matched courses, outline deadlines, schedule and shared updates. */
export const getMyTerm5 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = await allowedEmail(context.claims);
    const { term5Catalog: cat, courseTitles } = await import("./term5/catalog.server");
    const { enrollmentsFor, sharedFor } = await import("./term5/userDeadlines.server");
    const { enrollments, inRoster } = await enrollmentsFor(context.userId, email);
    const titles = courseTitles();
    const codes = new Set(enrollments.map((e) => e.courseCode));
    const sectionIds = new Set(enrollments.map((e) => e.sectionId).filter(Boolean) as string[]);
    const sessions = new Map(cat.sessions.map((s) => [s.outline_session_id, s]));
    const sourceKind = (id: string | null | undefined) => (id ? (cat.sources as Record<string, { kind: string }>)[id]?.kind ?? null : null);

    const classes: ScheduleClass[] = cat.classes
      .filter((c) => sectionIds.has(c.section_id))
      .map((c) => {
        const s = c.outline_session_id ? sessions.get(c.outline_session_id) : undefined;
        const labels = s?.session_labels ?? [];
        const prep = s
          ? cat.prep
              .filter((p) => p.course_code === c.course_code && p.applies_to_session_labels.some((l) => labels.includes(l)))
              .map((p) => ({
                id: p.preparation_id,
                title: p.title,
                kind: p.kind,
                requirement: p.requirement,
                timing: p.timing,
                alsoFor: p.applies_to_session_labels.filter((l) => !labels.includes(l)),
                note: p.source_requirement_note,
              }))
          : [];
        return {
          id: c.class_id,
          courseCode: c.course_code,
          courseName: titles[c.course_code] ?? c.course_code,
          section: c.section_id.split("_").pop() ?? "",
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          room: c.room,
          sessionTitle: s?.title ?? null,
          sessionLabels: labels,
          mapping: c.session_mapping_status,
          sourceKind: sourceKind(s?.source_id),
          prep,
        };
      });

    const courses = cat.courses.map((c) => ({
      code: c.course_code,
      title: c.title,
      faculty: c.faculty,
      outlineKind: sourceKind(c.primary_source_id),
      sections: cat.sections.filter((s) => s.course_code === c.course_code).map((s) => s.section_id),
    }));

    return {
      inRoster,
      enrollments,
      courseTitles: titles,
      courses,
      outline: cat.occurrences.filter((o) => codes.has(o.course_code)),
      outlineSourceKinds: Object.fromEntries(cat.courses.map((c) => [c.course_code, sourceKind(c.primary_source_id)])),
      classes,
      shared: await sharedFor(enrollments),
      term: cat.meta,
    };
  });

export const saveEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseCode: string; sectionId: string | null; removed: boolean }) =>
    z.object({ courseCode: z.string().regex(/^[A-Z0-9.]{2,12}$/), sectionId: z.string().max(20).nullable(), removed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await allowedEmail(context.claims);
    const { term5Catalog: cat } = await import("./term5/catalog.server");
    if (!cat.courses.some((c) => c.course_code === data.courseCode)) throw new Error("unknown_course");
    if (data.sectionId && !cat.sections.some((s) => s.section_id === data.sectionId && s.course_code === data.courseCode))
      throw new Error("unknown_section");
    const { error } = await context.supabase.from("term5_enrollment_overrides").upsert(
      { user_id: context.userId, course_code: data.courseCode, section_id: data.sectionId, removed: data.removed, updated_at: new Date().toISOString() },
      { onConflict: "user_id,course_code" },
    );
    if (error) throw new Error("save_failed");
    return { ok: true };
  });

export const resetEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await allowedEmail(context.claims);
    await context.supabase.from("term5_enrollment_overrides").delete().eq("user_id", context.userId);
    return { ok: true };
  });
