import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPush } from "./webpush.server";
import { withinReminderWindow } from "@/lib/term5/model";
import { mergedForUser } from "@/lib/term5/userDeadlines.server";
import { claimReminder } from "./reminderClaims.server";
import { enrollmentsFor } from "@/lib/term5/userDeadlines.server";
import { campusFor } from "@/lib/term5/catalog.server";
import { sectionLetter, term5CodeFromShortName } from "@/lib/term5/model";

type NewItem = { external_key: string; title: string; due_at: string | null; moodle_course_id: number };

/**
 * Push a "New deadline" alert for each newly discovered upcoming deadline.
 * If it is already inside the 3-hour window, send the reminder instead (once) and
 * record it so the reminder schedule does not repeat it.
 */
export async function notifyNewDeadlines(userId: string, items: NewItem[]) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return;
  const [{ data: account }, { data: settings }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("user_settings").select("timezone").eq("user_id", userId).maybeSingle(),
  ]);
  const tz = settings?.timezone ?? "Asia/Kolkata";
  const merged = await mergedForUser(userId, account.user?.email ?? "");
  const seen = new Set<string>();
  for (const item of items) {
    const deadline = merged.find(d => d.own?.external_key === item.external_key);
    const dueAt = deadline?.dueAt;
    if (!deadline || !dueAt || deadline.submissionStatus === "submitted" || seen.has(deadline.id)) continue;
    seen.add(deadline.id);
    const courseLabel = deadline.courseCode;
    let message;
    if (withinReminderWindow(dueAt, Date.now())) {
      if (!deadline.remindable) continue;
      const tag = await claimReminder(userId, deadline.notifyKeys, dueAt);
      if (!tag) continue;
      const time = new Date(dueAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
      message = { title: `Due at ${time}: ${item.title}`, body: courseLabel || "Open your deadlines", url: "/deadlines", tag };
    } else {
      // One "new" alert per person per deadline, whether it came from their own sync or a classmate's.
      if (!(await claimReminder(userId, [`new:${item.external_key}`], dueAt))) continue;
      const when = new Date(dueAt).toLocaleString("en-IN", {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz,
      });
      message = {
        title: `New deadline: ${item.title}`,
        body: `${courseLabel ? `${courseLabel} · ` : ""}Due ${when}`,
        url: "/deadlines",
        tag: `new:${item.external_key}`,
      };
    }
    for (const sub of subs) {
      const r = await sendPush(sub, message);
      if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
}

const SHAREABLE = /^(assignment|quiz|forum|choice|text):/;

/** Tell classmates in the same course and section about a deadline first found by someone else's sync. */
export async function notifySectionmates(
  userId: string,
  items: NewItem[],
  courses: Array<{ id: number; shortname: string | null }>,
) {
  const now = Date.now();
  const shareable = items.filter((i) => SHAREABLE.test(i.external_key) && i.due_at && Date.parse(i.due_at) > now);
  if (!shareable.length) return;
  const { data: me } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = me.user?.email ?? "";
  const campus = campusFor(email);
  if (!campus) return;
  const mine = await enrollmentsFor(userId, email);
  const mySection = new Map(mine.enrollments.map((e) => [e.courseCode, sectionLetter(e.sectionId)]));
  const codeById = new Map(courses.map((c) => [c.id, term5CodeFromShortName(c.shortname, campus)]));
  const byCourse = new Map<string, NewItem[]>();
  for (const i of shareable) {
    const code = codeById.get(i.moodle_course_id);
    if (code && mySection.get(code)) byCourse.set(code, [...(byCourse.get(code) ?? []), i]);
  }
  if (!byCourse.size) return;

  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").neq("user_id", userId);
  const others = [...new Set((subs ?? []).map((s) => s.user_id))];
  for (const otherId of others) {
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(otherId);
      const otherEmail = u.user?.email ?? "";
      if (campusFor(otherEmail) !== campus) continue;
      const theirs = await enrollmentsFor(otherId, otherEmail);
      const matched = theirs.enrollments.flatMap((e) =>
        sectionLetter(e.sectionId) === mySection.get(e.courseCode) ? (byCourse.get(e.courseCode) ?? []).map((i) => ({ i, code: e.courseCode })) : [],
      );
      if (!matched.length) continue;
      const { data: settings } = await supabaseAdmin.from("user_settings").select("timezone").eq("user_id", otherId).maybeSingle();
      const tz = settings?.timezone ?? "Asia/Kolkata";
      for (const { i, code } of matched) {
        if (!(await claimReminder(otherId, [`new:${i.external_key}`], i.due_at!))) continue;
        const when = new Date(i.due_at!).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz });
        const message = { title: `New deadline: ${i.title}`, body: `${code} · Due ${when}`, url: "/deadlines", tag: `new:${i.external_key}` };
        for (const sub of (subs ?? []).filter((s) => s.user_id === otherId)) {
          const r = await sendPush(sub, message);
          if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    } catch {
      // One classmate's failure must not block the others.
    }
  }
}
