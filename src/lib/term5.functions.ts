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

export type { PrepItem, ScheduleClass } from "./term5/preparation";

/** The student's Term 5 plan: matched courses, outline deadlines, schedule and shared updates. */
export const getMyTerm5 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = await allowedEmail(context.claims);
    const { catalogFor, courseTitles } = await import("./term5/catalog.server");
    const { enrollmentsFor, sharedFor } = await import("./term5/userDeadlines.server");
    const { enrollments, inRoster, campus } = await enrollmentsFor(context.userId, email);
    const cat = catalogFor(campus);
    const titles = courseTitles(campus);
    const codes = new Set(enrollments.map((e) => e.courseCode));
    const { classesFor } = await import("./term5/preparation");
    const { courseRefsFor } = await import("./term5/userDeadlines.server");
    const sourceKind = (id: string | null | undefined) => (id ? (cat.sources as Record<string, { kind: string }>)[id]?.kind ?? null : null);

    const classes = classesFor(cat, enrollments, titles);

    const courses = cat.courses.map((c) => ({
      code: c.course_code,
      title: c.title,
      faculty: c.faculty,
      outlineKind: sourceKind(c.primary_source_id),
      sections: (cat.sections as { section_id: string; course_code: string }[]).filter((s) => s.course_code === c.course_code).map((s) => s.section_id),
    }));

    return {
      inRoster,
      campus,
      campusName: campus === "HYD" ? "Hyderabad" : "Mohali",
      enrollments,
      courseTitles: titles,
      courses,
      outline: cat.occurrences.filter((o) => codes.has(o.course_code)),
      classes,
      courseRefs: await courseRefsFor(enrollments, campus),
      shared: await sharedFor(enrollments, campus),
      term: cat.meta,
    };
  });

export const saveEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseCode: string; sectionId: string | null; removed: boolean }) =>
    z.object({ courseCode: z.string().regex(/^[A-Z0-9.]{2,12}$/), sectionId: z.string().max(20).nullable(), removed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const email = await allowedEmail(context.claims);
    const { campusFor, catalogFor } = await import("./term5/catalog.server");
    const campus = campusFor(email);
    if (!campus) throw new Error("not_on_class_list");
    const cat = catalogFor(campus);
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

/** Course packs and readings for one of the student's courses, read live with their own eLearn key. */
export const getCoursepacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseCode: string }) => z.object({ courseCode: z.string().regex(/^[A-Z0-9]{2,12}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const email = await allowedEmail(context.claims);
    const { enrollmentsFor, courseRefsFor } = await import("./term5/userDeadlines.server");
    const { enrollments, campus } = await enrollmentsFor(context.userId, email);
    const mine = enrollments.filter((e) => e.courseCode === data.courseCode);
    if (!mine.length) return { status: "not_enrolled" as const, items: [] };
    const refs = await courseRefsFor(mine, campus);
    const { listCoursepacks } = await import("./elearn/coursepack.server");
    try {
      const all = [];
      for (const r of refs) {
        const items = await listCoursepacks(context.userId, Number(r.moodle_course_id));
        if (items === null) return { status: "not_connected" as const, items: [] };
        all.push(...items.map((i) => ({ ...i, url: i.kind === "file" ? `/api/public/coursepack?t=${i.url}` : i.url })));
      }
      return { status: "ok" as const, items: all };
    } catch (e) {
      console.error("coursepacks", e instanceof Error ? e.message : e);
      return { status: "error" as const, items: [] };
    }
  });
