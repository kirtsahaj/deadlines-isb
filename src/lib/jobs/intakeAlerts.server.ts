import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PushTarget } from "@/lib/push/webpush.server";
import { sendPush } from "@/lib/push/webpush.server";
import { claimReminder } from "@/lib/push/reminderClaims.server";
import { isAdminEmail } from "@/lib/admin";
import { FORWARDED_FILTER, SILENCE_ALERT_MS, intakeSummary, problemLabel, type InboundRow } from "./intake";

const PROBLEM_LOOKBACK_MS = 24 * 3600_000;
const MAX_PROBLEM_ALERTS_PER_TICK = 3;

/**
 * Owner-only push alerts for the Placements feed, run on the existing placement-reminders schedule:
 * one alert per silence episode (no forwarded email for 24h) and one per problem email.
 */
export async function alertOwnerAboutIntake(subs: (PushTarget & { user_id: string })[], now = Date.now()): Promise<number> {
  const [{ data: last }, { data: recent }] = await Promise.all([
    supabaseAdmin.from("job_inbound_messages").select("received_at").or(FORWARDED_FILTER)
      .order("received_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("job_inbound_messages").select("id, status, reason, subject, received_at")
      .gt("received_at", new Date(now - PROBLEM_LOOKBACK_MS).toISOString()).limit(500),
  ]);
  const lastForwardedAt = last?.received_at ?? null;
  const silent = !!lastForwardedAt && now - Date.parse(lastForwardedAt) > SILENCE_ALERT_MS;
  const problems = intakeSummary((recent ?? []) as InboundRow[], now).problems;
  if (!silent && !problems.length) return 0;

  // Find the owner among accounts that can receive notifications (only looked up when needed).
  let ownerId: string | null = null;
  for (const id of [...new Set(subs.map((s) => s.user_id))]) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (isAdminEmail(data.user?.email)) {
      ownerId = id;
      break;
    }
  }
  if (!ownerId) return 0;
  const ownerSubs = subs.filter((s) => s.user_id === ownerId);

  const messages: object[] = [];
  if (silent && lastForwardedAt && (await claimReminder(ownerId, [`intake-silence:${lastForwardedAt}`], lastForwardedAt))) {
    const when = new Date(lastForwardedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
    messages.push({
      title: "Placements: no CAS emails for 24 hours",
      body: `Last one arrived ${when}. Check your Outlook forwarding rule and Resend.`,
      url: "/admin",
      tag: "intake-silence",
    });
  }
  for (const row of problems.slice(0, MAX_PROBLEM_ALERTS_PER_TICK)) {
    if (!(await claimReminder(ownerId, [`intake-problem:${row.id}`], row.received_at))) continue;
    messages.push({
      title: "Placements email needs attention",
      body: `${problemLabel(row)}: ${row.subject ?? "subject unknown"}`.slice(0, 180),
      url: "/admin",
      tag: `intake-problem-${row.id}`,
    });
  }

  let sent = 0;
  for (const message of messages) {
    for (const sub of ownerSubs) {
      const r = await sendPush(sub, message);
      if (r === "sent") sent++;
      if (r === "gone") await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
  return sent;
}
