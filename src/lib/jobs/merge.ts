import type { ParsedJobEvent } from "./parse";

export type JobFacts = {
  id: string | null;
  company: string;
  role: string;
  companyKey: string;
  roleKeys: string[];
  roleAliases: string[];
  deadlineDate: string | null;
  deadlineTime: string | null;
  shortlistDate: string | null;
  /** When each fact was last set, by original email time, so late older updates never win. */
  fieldSentAt: Record<string, string>;
};

export const companyKey = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(pvt|private|ltd|limited|inc|llp|llc|corp|corporation)\b/g, " ").replace(/\s+/g, " ").trim();
export const roleKey = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

export type Match = { type: "job"; job: JobFacts } | { type: "none" } | { type: "ambiguous" };

/** Same company + same role (or a retained alias) is the same job; different roles are different jobs. */
export function matchJob(jobs: JobFacts[], ev: ParsedJobEvent): Match {
  const candidates = jobs.filter((j) => j.companyKey === companyKey(ev.company));
  const keys = [ev.role, ev.rename?.from, ev.rename?.to].filter((k): k is string => !!k).map(roleKey);
  if (!keys.length) return candidates.length ? { type: "ambiguous" } : { type: "none" };
  const hits = candidates.filter((j) => keys.some((k) => j.roleKeys.includes(k)));
  if (hits.length === 1) return { type: "job", job: hits[0] };
  if (hits.length > 1) return { type: "ambiguous" };
  return { type: "none" };
}

export type ApplyOutcome = "created" | "updated" | "noop" | "unspecified";

export function applyEvent(job: JobFacts | null, ev: ParsedJobEvent, sentAt: string): { job: JobFacts; outcome: ApplyOutcome } {
  if (!job) {
    const role = ev.role ?? "Role not stated";
    const stamp: Record<string, string> = {};
    if (ev.deadline?.date) stamp["deadlineDate"] = sentAt;
    if (ev.deadline?.time) stamp["deadlineTime"] = sentAt;
    if (ev.shortlist) stamp["shortlistDate"] = sentAt;
    return {
      outcome: "created",
      job: {
        id: null,
        company: ev.company,
        role,
        companyKey: companyKey(ev.company),
        roleKeys: [roleKey(role)],
        roleAliases: [],
        deadlineDate: ev.deadline?.date ?? null,
        deadlineTime: ev.deadline?.time ?? null,
        shortlistDate: ev.shortlist?.date ?? null,
        fieldSentAt: stamp,
      },
    };
  }

  const next: JobFacts = { ...job, roleKeys: [...job.roleKeys], roleAliases: [...job.roleAliases], fieldSentAt: { ...job.fieldSentAt } };
  let changed = false;
  const set = <K extends "deadlineDate" | "deadlineTime" | "shortlistDate" | "role">(field: K, value: string | undefined, onlyIfMissing: boolean) => {
    if (!value) return;
    if (onlyIfMissing && next[field]) return;
    if ((next.fieldSentAt[field] ?? "") > sentAt) return;
    if (next[field] === value) return;
    next[field] = value as JobFacts[K];
    next.fieldSentAt[field] = sentAt;
    changed = true;
  };

  if (ev.kind === "broadcast") {
    // A repeat broadcast only fills gaps; established facts change only through explicit modifications.
    set("deadlineDate", ev.deadline?.date, true);
    set("deadlineTime", ev.deadline?.time, true);
    set("shortlistDate", ev.shortlist?.date, true);
    return { job: next, outcome: changed ? "updated" : "noop" };
  }

  const explicit = !!(ev.deadline?.date || ev.deadline?.time || ev.shortlist || ev.rename);
  if (!explicit) return { job: next, outcome: "unspecified" };

  if (ev.rename) {
    const before = next.role;
    set("role", ev.rename.to, false);
    if (next.role !== before) {
      if (!next.roleAliases.includes(before)) next.roleAliases.push(before);
      for (const k of [roleKey(before), roleKey(ev.rename.from), roleKey(ev.rename.to)]) if (!next.roleKeys.includes(k)) next.roleKeys.push(k);
    }
  }
  set("deadlineDate", ev.deadline?.date, false);
  set("deadlineTime", ev.deadline?.time, false);
  set("shortlistDate", ev.shortlist?.date, false);
  return { job: next, outcome: changed ? "updated" : "noop" };
}
