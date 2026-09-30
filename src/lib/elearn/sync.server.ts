import { decryptToken } from "./crypto.server";
import { MoodleClient, MoodleError } from "./moodle.server";
import { normalizeDeadlines } from "./normalize";
import { manualCooldownSeconds, syncConcurrency, syncIntervalMinutes } from "./config.server";

type Json = Record<string, unknown>;
type SourceStatus = Record<string, { ok: boolean; code?: string; count?: number }>;

export type SyncResult =
  | { ok: true; outcome: "success" | "partial"; itemCount: number; lastSyncedAt: string; sourceStatus: SourceStatus }
  | { ok: false; error: string; retryAfterSeconds?: number };

const asList = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter((item): item is Json => !!item && typeof item === "object") : [];

async function limitedMap<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    output.push(...(await Promise.all(items.slice(i, i + limit).map(task))));
  }
  return output;
}

/**
 * The full read-only normalization pipeline. Runs for manual and scheduled
 * syncs alike. Never logs tokens or tokenized URLs.
 */
export async function runSync(
  userId: string,
  trigger: "manual" | "scheduled" | "first_connect",
): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const started = new Date();
  let runId = "";

  try {
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("elearn_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (connectionError || !connection) return { ok: false, error: "not_connected" };

    if (trigger === "manual" && connection.last_manual_sync_at) {
      const cooldown = manualCooldownSeconds() * 1000;
      const remaining = cooldown - (Date.now() - new Date(connection.last_manual_sync_at).getTime());
      if (remaining > 0) {
        return { ok: false, error: "sync_cooldown", retryAfterSeconds: Math.ceil(remaining / 1000) };
      }
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from("sync_runs")
      .insert({ user_id: userId, trigger, outcome: "running" })
      .select("id")
      .single();
    if (runError || !run) throw new Error("database");
    runId = run.id;

    await supabaseAdmin
      .from("elearn_connections")
      .update({
        status: "syncing",
        last_attempt_at: started.toISOString(),
        ...(trigger === "manual" ? { last_manual_sync_at: started.toISOString() } : {}),
      })
      .eq("user_id", userId);

    const token = await decryptToken(
      connection.token_ciphertext,
      connection.token_iv,
      userId,
      connection.base_url,
    );
    const client = new MoodleClient(token);
    const sourceStatus: SourceStatus = {};
    const safe = async (
      name: string,
      call: () => Promise<Json | unknown[]>,
      fallback: Json | unknown[],
    ): Promise<Json | unknown[]> => {
      try {
        const value = await call();
        sourceStatus[name] = Array.isArray(value)
          ? { ok: true, count: value.length }
          : { ok: true };
        return value;
      } catch (error) {
        sourceStatus[name] = {
          ok: false,
          code: error instanceof MoodleError ? error.code : "source_failed",
        };
        return fallback;
      }
    };

    const site = (await client.call("core_webservice_get_site_info")) as Json;
    const moodleUserId = Number(site["userid"]);
    if (!Number.isFinite(moodleUserId)) throw new MoodleError("schema");

    const coursesRaw = await safe(
      "courses",
      () => client.call("core_enrol_get_users_courses", { userid: moodleUserId }),
      [],
    );
    const courses = asList(coursesRaw);
    const courseIds = courses
      .map((course) => Number(course["id"]))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!courseIds.length && !sourceStatus["courses"]?.ok) throw new Error("courses_unavailable");

    const assignments = (await safe(
      "assignments",
      () => client.call("mod_assign_get_assignments", { courseids: courseIds }),
      { courses: [] },
    )) as Json;
    const quizzes = (await safe(
      "quizzes",
      () => client.call("mod_quiz_get_quizzes_by_courses", { courseids: courseIds }),
      { quizzes: [] },
    )) as Json;
    const forums = await safe(
      "forums",
      () => client.call("mod_forum_get_forums_by_courses", { courseids: courseIds }),
      [],
    );
    const calendar = (await safe(
      "calendar",
      () =>
        client.call("core_calendar_get_calendar_events", {
          events: { courseids: courseIds },
          options: {
            timestart: 0,
            timeend: 0,
            userevents: true,
            siteevents: false,
            ignorehidden: true,
          },
        }),
      { events: [] },
    )) as Json;

    const concurrency = syncConcurrency();
    const contentPairs = await limitedMap(courseIds, concurrency, async (courseId) => {
      const value = await safe(
        `contents:${courseId}`,
        () => client.call("core_course_get_contents", { courseid: courseId }),
        [],
      );
      return [courseId, asList(value)] as const;
    });
    const contents = new Map<number, Json[]>(contentPairs);

    const assignmentObjects = asList(assignments["courses"]).flatMap((course) =>
      asList(course["assignments"]),
    );
    const oldestUseful = Math.floor(Date.now() / 1000) - 30 * 86400;
    const statusCandidates = assignmentObjects.filter((assignment) => {
      const due = Number(assignment["duedate"] ?? 0);
      return !due || due >= oldestUseful;
    });
    const submissionPairs = await limitedMap(statusCandidates, concurrency, async (assignment) => {
      const id = Number(assignment["id"]);
      if (!Number.isInteger(id) || id <= 0) return null;
      const value = await safe(
        `submission:${id}`,
        () => client.call("mod_assign_get_submission_status", { assignid: id }),
        {},
      );
      return [id, value as Json] as const;
    });
    const submissions = new Map<number, Json>(
      submissionPairs.filter((item): item is readonly [number, Json] => item !== null),
    );

    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("explicit_deadline_marker_only")
      .eq("user_id", userId)
      .maybeSingle();

    const deadlines = normalizeDeadlines({
      assignments,
      submissions,
      quizzes,
      forums: forums as Json | Json[],
      calendar,
      contents,
      markerOnly: settings?.explicit_deadline_marker_only ?? false,
    });

    if (courses.length) {
      const { error } = await supabaseAdmin.from("courses").upsert(
        courses.map((course) => ({
          user_id: userId,
          moodle_course_id: Number(course["id"]),
          short_name: typeof course["shortname"] === "string" ? course["shortname"] : null,
          full_name: String(course["fullname"] ?? course["displayname"] ?? "Untitled course"),
          visible: course["visible"] !== 0,
          last_seen_at: started.toISOString(),
        })),
        { onConflict: "user_id,moodle_course_id" },
      );
      if (error) throw new Error("database");
    }
    if (deadlines.length) {
      const { error } = await supabaseAdmin
        .from("deadline_items")
        .upsert(
          deadlines.map((row) => ({ ...row, user_id: userId })),
          { onConflict: "user_id,external_key" },
        );
      if (error) throw new Error("database");
    }

    const complete = Object.values(sourceStatus).every((value) => value.ok);
    const deactivateMissing = async (source: string) => {
      await supabaseAdmin
        .from("deadline_items")
        .update({ active: false, removed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("source_primary", source)
        .eq("active", true)
        .lt("last_seen_at", started.toISOString());
    };
    if (sourceStatus["assignments"]?.ok) await deactivateMissing("mod_assign_get_assignments");
    if (sourceStatus["quizzes"]?.ok) await deactivateMissing("mod_quiz_get_quizzes_by_courses");
    if (sourceStatus["forums"]?.ok) await deactivateMissing("mod_forum_get_forums_by_courses");
    if (sourceStatus["calendar"]?.ok) await deactivateMissing("core_calendar_get_calendar_events");
    if (courseIds.length && courseIds.every((id) => sourceStatus[`contents:${id}`]?.ok)) {
      await deactivateMissing("core_course_get_contents.description");
    }

    // Purge rows that have been gone for more than 30 days.
    await supabaseAdmin
      .from("deadline_items")
      .delete()
      .eq("user_id", userId)
      .eq("active", false)
      .lt("removed_at", new Date(Date.now() - 30 * 86400_000).toISOString());

    const interval = syncIntervalMinutes();
    const jitterMinutes = Math.floor(Math.random() * Math.max(2, Math.floor(interval / 5)));
    const nextSync = new Date(Date.now() + (interval + jitterMinutes) * 60_000).toISOString();
    const outcome = complete ? "success" : "partial";
    const finishedAt = new Date().toISOString();

    await supabaseAdmin
      .from("elearn_connections")
      .update({
        status: complete ? "connected" : "partial",
        last_success_at: finishedAt,
        next_sync_at: nextSync,
        consecutive_failures: 0,
        safe_error_code: complete ? null : "partial_sources",
      })
      .eq("user_id", userId);
    await supabaseAdmin.from("sync_queue").upsert({
      user_id: userId,
      run_after: nextSync,
      priority: 0,
      attempts: 0,
      locked_at: null,
      locked_by: null,
    });
    await supabaseAdmin
      .from("sync_runs")
      .update({
        outcome,
        source_status: sourceStatus,
        item_count: deadlines.length,
        duration_ms: Date.now() - started.getTime(),
        finished_at: finishedAt,
      })
      .eq("id", runId);

    return {
      ok: true,
      outcome,
      itemCount: deadlines.length,
      lastSyncedAt: finishedAt,
      sourceStatus,
    };
  } catch (error) {
    const code =
      error instanceof MoodleError
        ? error.code
        : error instanceof Error
          ? error.message
          : "sync_failed";
    const { data: connection } = await supabaseAdmin
      .from("elearn_connections")
      .select("consecutive_failures")
      .eq("user_id", userId)
      .maybeSingle();
    if (connection) {
      const failures = Number(connection.consecutive_failures ?? 0) + 1;
      const delayMinutes = Math.min(360, 5 * 2 ** Math.min(failures, 6));
      const nextSync = new Date(Date.now() + delayMinutes * 60_000).toISOString();
      await supabaseAdmin
        .from("elearn_connections")
        .update({
          status: failures >= 3 ? "attention" : "partial",
          consecutive_failures: failures,
          safe_error_code: code,
          next_sync_at: nextSync,
        })
        .eq("user_id", userId);
      await supabaseAdmin.from("sync_queue").upsert({
        user_id: userId,
        run_after: nextSync,
        priority: 0,
        locked_at: null,
        locked_by: null,
      });
    }
    if (runId) {
      await supabaseAdmin
        .from("sync_runs")
        .update({
          outcome: "failed",
          safe_error_code: code,
          duration_ms: Date.now() - started.getTime(),
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return { ok: false, error: code === "invalidtoken" ? "reconnect_required" : "sync_failed" };
  }
}
