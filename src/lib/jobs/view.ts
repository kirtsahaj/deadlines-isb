import type { JobTile } from "@/lib/jobs.functions";

export type JobView = "upcoming" | "older";
export type JobSort = "deadline" | "recent";
export type JobFilter = "all" | "starred" | "jd";

const todayIst = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Passed per the email-stated deadline; not proof that the portal has closed. */
export function deadlinePassed(job: Pick<JobTile, "deadlineAt" | "deadlineDate">, now: number): boolean {
  if (job.deadlineAt) return new Date(job.deadlineAt).getTime() <= now;
  if (job.deadlineDate) return job.deadlineDate < todayIst(now);
  return false;
}

const sortKey = (j: JobTile) => j.deadlineAt ?? (j.deadlineDate ? `${j.deadlineDate}T18:29:59.999Z` : null);

export function jobsInView(jobs: JobTile[], o: { view: JobView; sort: JobSort; filter: JobFilter; search: string; now: number }): JobTile[] {
  const q = o.search.trim().toLowerCase();
  const list = jobs.filter((j) => {
    if ((o.view === "older") !== deadlinePassed(j, o.now)) return false;
    if (o.filter === "starred" && !j.starred) return false;
    if (o.filter === "jd" && !j.hasJd) return false;
    return !q || `${j.company} ${j.role}`.toLowerCase().includes(q);
  });
  if (o.sort === "recent") return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const dir = o.view === "older" ? -1 : 1;
  return list.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (!ka && !kb) return a.company.localeCompare(b.company);
    if (!ka) return 1;
    if (!kb) return -1;
    return dir * ka.localeCompare(kb);
  });
}
