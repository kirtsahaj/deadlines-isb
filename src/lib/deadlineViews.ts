export type DeadlineView = "upcoming" | "past";

type DatedRow = { due_at: string | null; title: string };

export function isDeadlineInView(
  dueAt: string | null,
  view: DeadlineView,
  nowMs: number,
  timezone: string,
): boolean {
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date(nowMs));
  if (!dueAt) return view === "upcoming";
  const dueMs = new Date(dueAt).getTime();
  return view === "upcoming" ? dueMs >= nowMs : dueMs < nowMs;
}

export function sortDeadlineView<T extends DatedRow>(rows: T[], view: DeadlineView): T[] {
  return [...rows].sort((a, b) => {
    if (!a.due_at) return !b.due_at ? a.title.localeCompare(b.title) : 1;
    if (!b.due_at) return -1;
    const difference = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (difference === 0) return a.title.localeCompare(b.title);
    return view === "upcoming" ? difference : -difference;
  });
}
