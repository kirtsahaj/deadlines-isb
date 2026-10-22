import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SetupNudges } from "@/components/SetupNudges";
import { useTerm5 } from "@/lib/useTerm5";
import type { ScheduleClass } from "@/lib/term5.functions";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Your Term 5 schedule — ISB Deadline Tracker" },
      { name: "description", content: "Your Term 5 Mohali classes with rooms, topics and what to prepare." },
      { property: "og:title", content: "Your Term 5 schedule — ISB Deadline Tracker" },
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
  unspecified: "Not specified",
};

function ClassCard({ c }: { c: ScheduleClass }) {
  const [open, setOpen] = useState(false);
  const inferred = c.mapping === "chronological_inference_requires_confirmation";
  const blocked = !c.sessionTitle;
  const groups = ["before_class", "in_class", "after_class", "context_only"]
    .map((t) => ({ t, items: c.prep.filter((p) => p.timing === t) }))
    .filter((g) => g.items.length);
  return (
    <article data-tile-type="preread" className="deadline-card px-3 py-3 sm:px-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="course-code">{c.courseCode}</span>
            <span className="text-xs text-muted-foreground">Section {c.section}</span>
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">
            {c.sessionTitle ?? "Topic not confirmed"}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {time(c.startsAt)}–{time(c.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {c.room}
            </span>
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground"
          title={blocked ? "Topic can't be matched to this date yet" : "Topic matched from the outline by class order"}
          aria-label={blocked ? "Topic not confirmed" : "Topic estimated from outline"}
        >
          {blocked ? "Unconfirmed" : "Outline"}
        </span>
      </div>
      {c.prep.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 text-preread">
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              Preparation ({c.prep.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {groups.map((g) => (
              <div key={g.t}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{TIMING[g.t] ?? g.t}</p>
                <ul className="mt-1 space-y-1.5">
                  {g.items.map((p) => (
                    <li key={p.id} className="text-sm">
                      <span>{p.title}</span>{" "}
                      <Badge variant={p.requirement === "assigned" ? "secondary" : "outline"} className="ml-1 align-middle">
                        {REQUIREMENT[p.requirement] ?? p.requirement}
                      </Badge>
                      {p.alsoFor.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          Same reading also listed for session {p.alsoFor.join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Preparation is for your own planning — it isn't a submission.
              {inferred ? " Topics are matched to dates by class order; your instructor may adjust." : ""}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
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
          <h1 className="text-3xl font-semibold text-preread">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">Term 5 · Mohali · your sections</p>
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
