/**
 * Daily portal check: keep the app's upcoming jobs in line with the placement portal's ACTIVE list.
 * Pure and browser-safe so it can be tested; the network and database parts live in portal.server.ts.
 *
 * Readings at 8 PM and 9 PM IST; changes are applied at 9 PM:
 * - add: an active, upcoming portal job that matches nothing in the app (never PPO/PPI-only postings);
 * - deadline: a matched job whose portal deadline differs (fills in times for date-only jobs too);
 * - hide: an upcoming app job the portal showed before (has a portal id) that is missing from BOTH
 *   readings. Email-only jobs never seen on the portal are never hidden. Without an 8 PM reading, no hides.
 * - unhide: a hidden job that is back on the portal.
 * Matching (no duplicates, no add-and-remove for the same role): portal id once linked; else company + role
 * after tidying (non-breaking/stray spaces, quotes, dashes, case, Pvt/Ltd suffixes); else, when exactly one
 * unmatched app job and one unmatched portal job share company and deadline, they are the same job.
 */
import { companyKey, roleKey } from "./merge";
import { istInstant } from "./parse";

export type PortalJob = { portalId: string; company: string; role: string; deadlineDate: string; deadlineTime: string };
export type AppJob = {
  id: string;
  company: string;
  role: string;
  roleKeys: string[];
  deadlineDate: string | null;
  deadlineTime: string | null;
  portalId: string | null;
  hidden: boolean;
};

/** Tidy portal/email text: odd spaces, curly quotes and dashes, repeated spaces. */
export function tidy(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[  -​  　﻿]/g, " ")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const coKey = (s: string) => companyKey(tidy(s));
const rKey = (s: string) => roleKey(tidy(s));

/** Postings meant only for PPO/PPI holders are never added by the check. */
export function isPpoPpi(job: { company: string; role: string }): boolean {
  return /\b(ppo|ppi)s?\b/i.test(`${job.role} ${job.company}`);
}

const DEADLINE = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/;

/** The four fields we use from each active-list row; rows missing any are counted as invalid. */
export function parsePortalRows(rows: unknown[]): { jobs: PortalJob[]; invalid: number } {
  const jobs: PortalJob[] = [];
  let invalid = 0;
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const id = typeof r["application_id"] === "string" ? r["application_id"].trim() : "";
    const company = typeof r["registered_company_name"] === "string" ? tidy(r["registered_company_name"]) : "";
    const role = typeof r["job_role_name"] === "string" ? tidy(r["job_role_name"]) : "";
    const m = typeof r["application_deadline"] === "string" ? DEADLINE.exec(r["application_deadline"].trim()) : null;
    if (!id || !company || !role || !m) {
      invalid++;
      continue;
    }
    jobs.push({ portalId: id, company, role, deadlineDate: m[1]!, deadlineTime: `${m[2]}:${m[3]}` });
  }
  return { jobs, invalid };
}

const istToday = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Still open: an exact deadline later than now, or a date-only deadline today or later (IST). */
export function upcoming(date: string | null, time: string | null, now: number): boolean {
  if (!date) return false;
  if (time) {
    const at = istInstant(date, time);
    return !!at && Date.parse(at) > now;
  }
  return date >= istToday(now);
}

export const deadlineLabel = (date: string | null, time: string | null) => (date ? `${date}${time ? ` ${time}` : ""}` : "");

export type SyncPlan = {
  add: PortalJob[];
  link: { jobId: string; portalId: string }[];
  deadline: { jobId: string; from: string; to: PortalJob }[];
  unhide: { jobId: string }[];
  hide: { jobId: string }[];
  seen: string[];
  skipped: PortalJob[];
};

export function planPortalSync(app: AppJob[], at9: PortalJob[], at8: PortalJob[] | null, now: number): SyncPlan {
  const plan: SyncPlan = { add: [], link: [], deadline: [], unhide: [], hide: [], seen: [], skipped: [] };
  const portal = at9.filter((p) => upcoming(p.deadlineDate, p.deadlineTime, now));
  const byPortalId = new Map(app.filter((a) => a.portalId).map((a) => [a.portalId!, a]));
  const used = new Set<string>();
  const matched = new Map<string, AppJob>(); // portalId → app job
  const unmatched: PortalJob[] = [];

  const relevant: PortalJob[] = [];
  for (const p of portal) {
    if (isPpoPpi(p)) plan.skipped.push(p);
    else relevant.push(p);
  }

  // 1) Linked before: portal id.
  const rest: PortalJob[] = [];
  for (const p of relevant) {
    const a = byPortalId.get(p.portalId);
    if (a) {
      matched.set(p.portalId, a);
      used.add(a.id);
    } else rest.push(p);
  }
  // 2) Same company + role after tidying (role aliases from renames count too).
  const free = () => app.filter((a) => !used.has(a.id) && !a.portalId);
  for (const p of rest) {
    const ck = coKey(p.company);
    const rk = rKey(p.role);
    const hits = free().filter((a) => coKey(a.company) === ck && (rKey(a.role) === rk || a.roleKeys.includes(rk)));
    // Several identical copies: prefer the one with the same deadline, else the latest.
    const pick =
      hits.find((a) => a.deadlineDate === p.deadlineDate && a.deadlineTime === p.deadlineTime) ??
      [...hits].sort((x, y) => (y.deadlineDate ?? "").localeCompare(x.deadlineDate ?? ""))[0];
    if (pick) {
      matched.set(p.portalId, pick);
      used.add(pick.id);
      plan.link.push({ jobId: pick.id, portalId: p.portalId });
    } else unmatched.push(p);
  }
  // 3) Renamed role: the only unmatched pair with the same company and deadline.
  const leftover: PortalJob[] = [];
  for (const p of unmatched) {
    const ck = coKey(p.company);
    const sameSlot = (a: { company: string; deadlineDate: string | null; deadlineTime: string | null }) =>
      coKey(a.company) === ck && a.deadlineDate === p.deadlineDate && (a.deadlineTime ?? "") === p.deadlineTime;
    const apps = free().filter((a) => upcoming(a.deadlineDate, a.deadlineTime, now) && sameSlot(a));
    const peers = unmatched.filter((q) => sameSlot(q));
    if (apps.length === 1 && peers.length === 1) {
      matched.set(p.portalId, apps[0]!);
      used.add(apps[0]!.id);
      plan.link.push({ jobId: apps[0]!.id, portalId: p.portalId });
    } else leftover.push(p);
  }
  plan.add = leftover;

  for (const [, a] of matched) plan.seen.push(a.id);
  for (const [portalId, a] of matched) {
    const p = relevant.find((x) => x.portalId === portalId)!;
    if (a.hidden) plan.unhide.push({ jobId: a.id });
    if (a.deadlineDate !== p.deadlineDate || (a.deadlineTime ?? "") !== p.deadlineTime) {
      plan.deadline.push({ jobId: a.id, from: deadlineLabel(a.deadlineDate, a.deadlineTime), to: p });
    }
  }

  // Hide: shown on the portal before, still upcoming, and missing from both readings.
  if (at8) {
    const present = new Set([...at9, ...at8].map((p) => p.portalId));
    for (const a of app) {
      if (!a.portalId || a.hidden || used.has(a.id)) continue;
      if (!upcoming(a.deadlineDate, a.deadlineTime, now)) continue;
      if (!present.has(a.portalId)) plan.hide.push({ jobId: a.id });
    }
  }
  return plan;
}

/** Owner notification title, e.g. "Portal check: 1 added, 1 deadline updated". Null when nothing changed. */
export function changeSummary(plan: Pick<SyncPlan, "add" | "deadline" | "hide" | "unhide">): string | null {
  const parts: string[] = [];
  if (plan.add.length) parts.push(`${plan.add.length} added`);
  if (plan.deadline.length) parts.push(`${plan.deadline.length} deadline${plan.deadline.length === 1 ? "" : "s"} updated`);
  if (plan.hide.length) parts.push(`${plan.hide.length} hidden`);
  if (plan.unhide.length) parts.push(`${plan.unhide.length} back`);
  return parts.length ? `Portal check: ${parts.join(", ")}` : null;
}

/** Which reading is due now (IST): 8 PM slot during 20:00–20:59, 9 PM slot during 21:00–21:59. */
export function portalSlot(now: number): "8pm" | "9pm" | null {
  const h = new Date(now + 5.5 * 3600_000).getUTCHours();
  return h === 20 ? "8pm" : h === 21 ? "9pm" : null;
}

export const portalDay = istToday;
