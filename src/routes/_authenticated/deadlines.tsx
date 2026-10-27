import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeadlineCard } from "@/components/DeadlineCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReminderSetupDialog } from "@/components/ReminderSetup";
import { SetupNudges } from "@/components/SetupNudges";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { useTerm5 } from "@/lib/useTerm5";
import { getConnectionState, syncNow } from "@/lib/elearn.functions";
import { DEFAULT_TIMEZONE, lastSyncedLabel } from "@/lib/format";
import { firstPreferredName } from "@/lib/preferredName";
import { inView, mergeDeadlines, sortView, type DeadlineView, type OutlineOccurrence, type OwnRow } from "@/lib/term5/model";

export const Route = createFileRoute("/_authenticated/deadlines")({
  head: () => ({
    meta: [
      { title: "Your deadlines — ISB Deadline Tracker" },
      { name: "description", content: "Every upcoming Term 5 and eLearn deadline in one list, with how confident each date is." },
      { property: "og:title", content: "Your deadlines — ISB Deadline Tracker" },
      { property: "og:description", content: "Every upcoming Term 5 and eLearn deadline in one list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeadlinesPage,
});

function DeadlinesPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<DeadlineView>("upcoming");
  const isMobile = useIsMobile();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  useEffect(() => {
    const notice = window.sessionStorage.getItem("deadline-tracker-sync-notice");
    window.sessionStorage.removeItem("deadline-tracker-sync-notice");
    setSyncMessage(notice);
  }, []);

  const connection = useQuery({
    queryKey: ["connection-state"],
    queryFn: () => getConnectionState(),
    refetchInterval: (query) => (query.state.data?.status === "syncing" ? 3000 : false),
  });
  const term5 = useTerm5();
  const connected = !!connection.data?.connected;

  const settings = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => (await supabase.from("user_settings").select("timezone, hidden_course_ids").maybeSingle()).data,
    enabled: !!user,
  });
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("display_name").maybeSingle()).data,
    enabled: !!user,
  });
  const courses = useQuery({
    queryKey: ["courses", user?.id],
    queryFn: async () =>
      (await supabase.from("courses").select("moodle_course_id, short_name, full_name").order("full_name")).data ?? [],
    enabled: !!user,
  });
  const deadlines = useQuery({
    queryKey: ["deadlines", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadline_items")
        .select(
          "id, activity_id, external_key, title, kind, deadline_type, deadline_status, submission_status, due_at, conflict, moodle_course_id, source_primary, source_evidence, text_evidence, text_precision",
        )
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as OwnRow[];
    },
    enabled: !!user,
  });

  const refresh = useMutation({
    mutationFn: () => syncNow(),
    onSuccess: async (result) => {
      if (result.ok) {
        setSyncMessage(
          result.outcome === "partial"
            ? "Refresh complete. Some eLearn sections were unavailable; your existing dates remain here."
            : `Updated — ${result.itemCount} eLearn deadline${result.itemCount === 1 ? "" : "s"} found.`,
        );
      } else if (result.error === "sync_cooldown") {
        const seconds = result.retryAfterSeconds ?? 60;
        setSyncMessage(
          seconds < 90
            ? `Just refreshed. Try again in ${seconds} seconds.`
            : `Just refreshed. Try again in about ${Math.ceil(seconds / 60)} minutes.`,
        );
      } else if (result.error === "reconnect_required") {
        setSyncMessage("Your eLearn connection expired. Reconnect from Menu.");
      } else {
        setSyncMessage("We couldn't reach eLearn just now. Please try again shortly.");
      }
      await queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      await connection.refetch();
    },
    onError: () => setSyncMessage("We couldn't reach eLearn just now. Please try again shortly."),
  });

  useEffect(() => {
    if (!connection.data?.connected || !connection.data.lastSuccessAt) return;
    void queryClient.invalidateQueries({ queryKey: ["deadlines"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }, [connection.data, queryClient]);

  const timezone = settings.data?.timezone ?? DEFAULT_TIMEZONE;
  const hidden = useMemo(() => new Set(settings.data?.hidden_course_ids ?? []), [settings.data?.hidden_course_ids]);

  const merged = useMemo(() => {
    if (!term5.data) return [];
    const refs = [...(courses.data ?? []), ...term5.data.courseRefs];
    return [...mergeDeadlines({
      now: Date.now(),
      enrollments: term5.data.enrollments,
      courseTitles: term5.data.courseTitles,
      outline: term5.data.outline as OutlineOccurrence[],
      own: deadlines.data ?? [],
      ownCourses: courses.data ?? [],
      ownLastSuccessAt: connection.data?.connected ? connection.data.lastSuccessAt : null,
      shared: term5.data.shared,
      campus: term5.data.campus,
    }).map(i => ({ ...i, moodleCourseId: i.moodleCourseId ?? refs.find(c => c.short_name === `${i.courseCode}_PGP${term5.data.campus}_2026-27_T5`)?.moodle_course_id ?? null }))].filter((i) => i.moodleCourseId === null || !hidden.has(i.moodleCourseId));
  }, [term5.data, deadlines.data, courses.data, connection.data, hidden]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return sortView(
      merged.filter((i) => {
        if (!inView(i, view, now)) return false;
        if (q && !`${i.title} ${i.courseName} ${i.courseCode}`.toLowerCase().includes(q)) return false;
        return true;
      }),
      view,
    );
  }, [merged, search, view]);

  const name = firstPreferredName(user?.user_metadata, profile.data?.display_name);
  const loading = connection.isLoading || term5.isLoading || (connected && deadlines.isLoading);

  return (
    <div className="space-y-3">
      {connected && <ReminderSetupDialog />}
      <header className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h1 className="text-3xl font-semibold">Hello{name ? ` ${name}` : ""}!</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {connected ? lastSyncedLabel(connection.data?.connected ? connection.data.lastSuccessAt : null) : term5.data?.inRoster ? "Showing your Term 5 outlines and class updates" : "Connect eLearn to see your deadlines"}
          </p>
        </div>
        {connected && (
          <Button variant="secondary" size="sm" className="tap-target" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCcw className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`} aria-hidden />
            {refresh.isPending ? "Refreshing…" : "Refresh now"}
          </Button>
        )}
      </header>

      <SetupNudges />

      {connection.data?.connected && connection.data.status === "attention" && (
        <div className="surface-card border-destructive/40 p-3 text-sm">
          eLearn has refused the last few refreshes. Your link has most likely expired —{" "}
          <Link to="/connect" className="font-medium underline">reconnect</Link>.
        </div>
      )}
      {syncMessage && <p role="status" className="text-sm text-muted-foreground">{syncMessage}</p>}

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isMobile ? "Search" : "Search deadlines"} aria-label="Search deadlines" className="h-10 border-border bg-card pl-9" />
        </div>
        <div className="flex h-10 shrink-0 items-center rounded-full bg-muted p-1" role="tablist" aria-label="Deadline view">
          {(["upcoming", "past"] as DeadlineView[]).map((value) => (
            <Button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              variant={view === value ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-full px-2.5 sm:px-3"
              onClick={() => setView(value)}
            >
              {value === "upcoming" ? "Upcoming" : "Past"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <h2 className="text-base font-semibold">{view === "upcoming" ? "No upcoming deadlines" : "No past deadlines"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {merged.length ? "No deadlines match your search." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <DeadlineCard
                item={item}
                timezone={timezone}
                connected={connected}
                outlineKind={term5.data?.outlineSourceKinds[item.courseCode] ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
