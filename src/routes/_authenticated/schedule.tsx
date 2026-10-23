import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BookOpen, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SetupNudges } from "@/components/SetupNudges";
import { useTerm5 } from "@/lib/useTerm5";
import { getConnectionState } from "@/lib/elearn.functions";
import { getCoursepacks, type ScheduleClass } from "@/lib/term5.functions";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Classes & Prereads — ISB Deadline Tracker" },
      { name: "description", content: "Your Term 5 classes with rooms, topics and what to read before each." },
      { property: "og:title", content: "Classes & Prereads — ISB Deadline Tracker" },
      { property: "og:description", content: "Classes, rooms, topics and preparation for your Term 5 sections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

const TZ = "Asia/Kolkata";
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso));
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

const TIMING: Record<string, string> = {
  before_class: "Before class",
  in_class: "In class",
  after_class: "After class",
  context_only: "Background",
};
const REQUIREMENT: Record<string, string> = {
  assigned: "Required",
  recommended: "Recommended",
  optional: "Optional",
  unspecified: "",
};

const PREREAD_KINDS = new Set(["reading", "case", "reference", "optional", "recommended", "watch", "listen"]);

type Pack = { id: string; name: string; kind: "file" | "link"; size: number | null; url: string };

function CoursepackButton({ courseCode }: { courseCode: string }) {
  const connection = useQuery({ queryKey: ["connection-state"], queryFn: () => getConnectionState() });
  const fetchPacks = useServerFn(getCoursepacks);
  const [dialog, setDialog] = useState<null | "connect" | "list" | "empty" | "error">(null);
  const [items, setItems] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (connection.data && !connection.data.connected) return setDialog("connect");
    setLoading(true);
    try {
      const r = await fetchPacks({ data: { courseCode } });
      if (r.status === "not_connected") return setDialog("connect");
      if (r.status !== "ok") return setDialog("error");
      setItems(r.items);
      const only = r.items.length === 1 ? r.items[0] : undefined;
      if (only) window.open(only.url, "_blank", "noopener");
      else setDialog(r.items.length ? "list" : "empty");
    } catch {
      setDialog("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" className="coursepack-btn mt-3" onClick={onClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookOpen className="size-4" aria-hidden />}
        Coursepack
        {!loading && <ArrowUpRight className="size-4" aria-hidden />}
      </Button>
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          {dialog === "connect" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect eLearn first</DialogTitle>
                <DialogDescription>Coursepacks are opened straight from your own eLearn, so connect it once.</DialogDescription>
              </DialogHeader>
              <Button asChild><Link to="/connect">Connect eLearn</Link></Button>
            </>
          ) : dialog === "list" ? (
            <>
              <DialogHeader>
                <DialogTitle>{courseCode} coursepacks</DialogTitle>
                <DialogDescription>From your eLearn course page.</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.id}>
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm hover:bg-muted">
                      <span className="min-w-0 break-words">{i.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {i.kind === "link" ? "Link" : i.size ? `${Math.max(1, Math.round(i.size / 1048576))} MB` : "File"}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <DialogHeader>
              <DialogTitle>{dialog === "empty" ? "No coursepack found" : "Couldn't reach eLearn"}</DialogTitle>
              <DialogDescription>
                {dialog === "empty"
                  ? "Your eLearn course page doesn't have a coursepack or reading file yet."
                  : "Please try again in a minute."}
              </DialogDescription>
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClassCard({ c }: { c: ScheduleClass }) {
  const prereads = c.prep.filter((p) => p.timing === "before_class" && PREREAD_KINDS.has(p.kind));
  const rest = c.prep.filter((p) => !prereads.includes(p));
  return (
    <article data-tile-type="preread" className="deadline-card px-3 py-3 sm:px-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="course-code">{c.courseCode}</span>
        <span className="font-medium text-foreground">{time(c.startsAt)}–{time(c.endsAt)}</span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden />
          {c.room}
        </span>
      </p>
      {c.sessionTitle && <h3 className="mt-1.5 text-base font-semibold leading-snug">{c.sessionTitle}</h3>}
      {prereads.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prereads</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {prereads.map((p) => (
              <li key={p.id}>
                {p.title}
                {p.requirement !== "assigned" && REQUIREMENT[p.requirement] && (
                  <span className="text-muted-foreground"> · {REQUIREMENT[p.requirement]}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rest.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm">
          {rest.map((p) => (
            <li key={p.id}>
              <span className="text-muted-foreground">{TIMING[p.timing] ?? "Note"}:</span> {p.title}
            </li>
          ))}
        </ul>
      )}
      {prereads.length > 0 && <CoursepackButton courseCode={c.courseCode} />}
    </article>
  );
}

function SchedulePage() {
  const term5 = useTerm5();
  const navigate = useNavigate();
  useEffect(() => {
    if (term5.data && !term5.data.inRoster) void navigate({ to: "/deadlines", replace: true });
  }, [term5.data, navigate]);
  const [showPast, setShowPast] = useState(false);
  const days = useMemo(() => {
    const now = Date.now();
    const list = (term5.data?.classes ?? [])
      .filter((c) => showPast || new Date(c.endsAt).getTime() >= now - 3600_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const map = new Map<string, ScheduleClass[]>();
    for (const c of list) {
      const k = dayKey(c.startsAt);
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.entries()];
  }, [term5.data, showPast]);

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-3xl font-semibold">Classes &amp; Prereads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your timetable, rooms and what to read before each class</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Hide past classes" : "Show past classes"}
        </Button>
      </header>
      <SetupNudges />
      {term5.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !days.length ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          No classes to show. Check your courses and sections in Menu → My courses.
        </div>
      ) : (
        days.map(([key, classes]) => (
          <section key={key} className="space-y-2">
            <h2 className="sticky top-16 z-10 bg-background/90 py-1 text-sm font-semibold backdrop-blur">{classes[0] ? dayLabel(classes[0].startsAt) : key}</h2>
            <ul className="space-y-3">
              {classes.map((c) => (
                <li key={c.id}>
                  <ClassCard c={c} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
