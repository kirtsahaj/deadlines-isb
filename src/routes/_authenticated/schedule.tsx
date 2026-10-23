import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SetupNudges } from "@/components/SetupNudges";
import { useTerm5 } from "@/lib/useTerm5";
import type { ScheduleClass } from "@/lib/term5.functions";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Prereads — ISB Deadline Tracker" },
      { name: "description", content: "Your Term 5 classes with rooms, topics and what to read before each." },
      { property: "og:title", content: "Prereads — ISB Deadline Tracker" },
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

function ClassCard({ c }: { c: ScheduleClass }) {
  const [open, setOpen] = useState(false);
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
      {c.sessionTitle && <h3 className="mt-1.5 text-base font-semibold leading-snug">“{c.sessionTitle}”</h3>}
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
        <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              More for this class ({rest.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-1 pl-1 text-sm">
              {rest.map((p) => (
                <li key={p.id}>
                  <span className="text-muted-foreground">{TIMING[p.timing] ?? "Note"}:</span> {p.title}
                </li>
              ))}
            </ul>
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
          <h1 className="text-3xl font-semibold">Prereads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your classes and what to read before each</p>
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
