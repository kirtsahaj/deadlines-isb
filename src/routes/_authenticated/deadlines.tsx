import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeadlineCard, type DeadlineRow } from "@/components/DeadlineCard";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { getConnectionState, syncNow } from "@/lib/elearn.functions";
import { DEFAULT_TIMEZONE, lastSyncedLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/deadlines")({
  head: () => ({
    meta: [
      { title: "Your deadlines — ISB Deadline Tracker" },
      {
        name: "description",
        content: "Every upcoming eLearn assignment, quiz, forum and calendar deadline in one list.",
      },
      { property: "og:title", content: "Your deadlines — ISB Deadline Tracker" },
      {
        property: "og:description",
        content: "Every upcoming eLearn assignment, quiz, forum and calendar deadline in one list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeadlinesPage,
});

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-success text-success-foreground" },
  syncing: { label: "Refreshing…", className: "bg-secondary text-secondary-foreground" },
  partial: { label: "Partly updated", className: "bg-warning text-warning-foreground" },
  attention: { label: "Needs attention", className: "bg-destructive text-destructive-foreground" },
};

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: DEFAULT_TIMEZONE })
      .format(new Date())
      .replace(/\D/g, ""),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DeadlinesPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const connection = useQuery({
    queryKey: ["connection-state"],
    queryFn: () => getConnectionState(),
    refetchInterval: (query) =>
      (query.state.data as { status?: string } | undefined)?.status === "syncing" ? 4000 : false,
  });

  const settings = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("timezone, sort_order, hidden_course_ids")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const courses = useQuery({
    queryKey: ["courses", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("moodle_course_id, short_name, full_name")
        .order("full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const deadlines = useQuery({
    queryKey: ["deadlines", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadline_items")
        .select(
          "id, title, kind, deadline_type, deadline_status, submission_status, due_at, conflict, moodle_course_id, source_primary, source_evidence, text_evidence, text_precision",
        )
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as DeadlineRow[];
    },
    enabled: !!user,
  });

  const refresh = useMutation({
    mutationFn: () => syncNow(),
    onSuccess: async (result) => {
      if (result.ok) {
        setSyncMessage(
          result.outcome === "partial"
            ? "Updated, but eLearn didn't return everything this time."
            : `Updated — ${result.itemCount} deadline${result.itemCount === 1 ? "" : "s"} found.`,
        );
      } else if (result.error === "sync_cooldown") {
        setSyncMessage(
          `Just refreshed. Try again in about ${Math.ceil((result.retryAfterSeconds ?? 60) / 60)} minute(s).`,
        );
      } else if (result.error === "reconnect_required") {
        setSyncMessage("Your eLearn connection expired. Reconnect from Settings.");
      } else {
        setSyncMessage("We couldn't reach eLearn just now. Please try again shortly.");
      }
      await queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      await queryClient.invalidateQueries({ queryKey: ["courses"] });
      await connection.refetch();
    },
    onError: () => setSyncMessage("We couldn't reach eLearn just now. Please try again shortly."),
  });

  const timezone = settings.data?.timezone ?? DEFAULT_TIMEZONE;
  const sortOrder = settings.data?.sort_order ?? "latest_first";
  const hidden = useMemo(
    () => new Set(settings.data?.hidden_course_ids ?? []),
    [settings.data?.hidden_course_ids],
  );

  const courseName = (id: number) => {
    const course = courses.data?.find((item) => item.moodle_course_id === id);
    return course?.short_name || course?.full_name || "Course";
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (deadlines.data ?? []).filter((item) => {
      if (hidden.has(item.moodle_course_id)) return false;
      if (courseFilter !== "all" && String(item.moodle_course_id) !== courseFilter) return false;
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (
        term &&
        !`${item.title} ${courseName(item.moodle_course_id)}`.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (!a.due_at && !b.due_at) return a.title.localeCompare(b.title);
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      const diff = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      return sortOrder === "earliest_first" ? diff : -diff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlines.data, courses.data, hidden, courseFilter, kindFilter, search, sortOrder]);

  if (connection.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (connection.data && !connection.data.connected) {
    return (
      <div className="surface-card mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Let's bring in your deadlines</h1>
        <p className="text-sm text-muted-foreground">
          Connect your eLearn coursework once — about two minutes on a laptop, no password needed.
        </p>
        <Button asChild className="tap-target">
          <Link to="/connect">Start the connection steps</Link>
        </Button>
      </div>
    );
  }

  const status = connection.data?.connected ? connection.data.status : "connected";
  const statusCopy = STATUS_COPY[status ?? "connected"] ?? STATUS_COPY["connected"]!;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold">{greeting()}</h1>
            <p className="text-sm text-muted-foreground">
              {lastSyncedLabel(connection.data?.connected ? connection.data.lastSuccessAt : null)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusCopy.className}>{statusCopy.label}</Badge>
            <Button
              variant="secondary"
              size="sm"
              className="tap-target"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCcw
                className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refresh.isPending ? "Refreshing…" : "Refresh now"}
            </Button>
          </div>
        </div>

        {status === "attention" && (
          <div className="surface-card border-destructive/40 p-3 text-sm">
            eLearn has refused the last few refreshes. Your code has most likely expired —{" "}
            <Link to="/settings" className="font-medium underline">
              reconnect from Settings
            </Link>
            .
          </div>
        )}
        {syncMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {syncMessage}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search deadlines"
            aria-label="Search deadlines"
            className="pl-9"
          />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by course">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {(courses.data ?? []).map((course) => (
              <SelectItem key={course.moodle_course_id} value={String(course.moodle_course_id)}>
                {course.short_name || course.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-36" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="assignment">Assignments</SelectItem>
            <SelectItem value="quiz">Quizzes</SelectItem>
            <SelectItem value="forum">Forums</SelectItem>
            <SelectItem value="calendar">Calendar</SelectItem>
            <SelectItem value="text">Mentioned in text</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {deadlines.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card p-6 text-center">
          <h2 className="text-base font-semibold">Nothing to show here</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {deadlines.data?.length
              ? "No deadlines match your current search or filters."
              : "No deadlines found yet. Try Refresh now, or check that your courses have started."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <DeadlineCard
                item={item}
                courseName={courseName(item.moodle_course_id)}
                timezone={timezone}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
