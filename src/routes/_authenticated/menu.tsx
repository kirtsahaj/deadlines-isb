import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { useTerm5 } from "@/lib/useTerm5";
import { disconnectElearn, getAccountAccess, getConnectionState } from "@/lib/elearn.functions";
import { resetEnrollments, saveEnrollment } from "@/lib/term5.functions";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/format";
import { ReminderSettings } from "@/components/ReminderSetup";
import { ConnectionTroubleshooting } from "@/components/ConnectionGuide";
import { ConfidenceLegend } from "@/components/Confidence";
import { SetupNudges } from "@/components/SetupNudges";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({
    meta: [
      { title: "Menu — ISB Deadline Tracker" },
      { name: "description", content: "Your eLearn connection, courses, reminders, display options and help." },
      { property: "og:title", content: "Menu — ISB Deadline Tracker" },
      { property: "og:description", content: "Connection, courses, reminders, display options and help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"];
const WHATSAPP_URL = "https://wa.me/918890060456";

const FAQ = [
  {
    q: "Where do these dates come from?",
    a: "Your own eLearn (when connected), course updates seen on classmates' eLearn for your section, and your Term 5 course outlines. Tap the dot on any card to see exactly which.",
  },
  {
    q: "What do the dots mean?",
    a: "They show how confident the tracker is right now — not a guarantee. See the key below.",
  },
  {
    q: "What is shared from my eLearn?",
    a: "Only course deadline details (title, type and date) for Term 5 courses, so classmates in your section see them too. Never your link, name, submissions, grades or extensions.",
  },
  {
    q: "Can this app submit work or change anything?",
    a: "No. It only reads. It cannot submit, post, edit or delete anything in eLearn, and it never has your password.",
  },
  {
    q: "How often does it refresh?",
    a: "About every 2 hours, even when the tracker is closed. Refresh now asks for an extra update.",
  },
  {
    q: "My connection stopped working",
    a: "eLearn links expire. Choose Reconnect with a new link under eLearn connection. Your saved deadlines stay.",
  },
] as const;

function MyCourses() {
  const term5 = useTerm5();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (d: { courseCode: string; sectionId: string | null; removed: boolean }) => saveEnrollment({ data: d }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["term5"] }),
  });
  const reset = useMutation({
    mutationFn: () => resetEnrollments(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["term5"] }),
  });
  const [adding, setAdding] = useState("");
  if (!term5.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const mine = new Map(term5.data.enrollments.map((e) => [e.courseCode, e]));
  const others = term5.data.courses.filter((c) => !mine.has(c.code));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {term5.data.inRoster
          ? "Matched from the Term 5 Mohali class list. Fix anything that's wrong."
          : "You're not on the class list we have. Add your courses and sections."}
      </p>
      <ul className="space-y-2">
        {term5.data.courses
          .filter((c) => mine.has(c.code))
          .map((c) => {
            const e = mine.get(c.code)!;
            return (
              <li key={c.code} className="flex flex-wrap items-center gap-2">
                <span className="course-code">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                <Select
                  value={e.sectionId ?? "none"}
                  onValueChange={(v) => save.mutate({ courseCode: c.code, sectionId: v === "none" ? null : v, removed: false })}
                >
                  <SelectTrigger className="w-28" aria-label={`Section for ${c.code}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure</SelectItem>
                    {c.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        Section {s.split("_").pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => save.mutate({ courseCode: c.code, sectionId: null, removed: true })}>
                  Remove
                </Button>
              </li>
            );
          })}
      </ul>
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Add a course">
              <SelectValue placeholder="Add a course" />
            </SelectTrigger>
            <SelectContent>
              {others.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            disabled={!adding}
            onClick={() => {
              save.mutate({ courseCode: adding, sectionId: null, removed: false });
              setAdding("");
            }}
          >
            Add
          </Button>
        </div>
      )}
      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => reset.mutate()}>
        Reset to class list
      </Button>
    </div>
  );
}

function MenuPage() {
  const { user, session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "home-screen") setOpen(["reminders"]);
    if (hash === "courses") setOpen(["courses"]);
  }, []);

  const connection = useQuery({ queryKey: ["connection-state"], queryFn: () => getConnectionState() });
  const access = useQuery({ queryKey: ["account-access", session?.user.id], queryFn: () => getAccountAccess(), enabled: !!session });
  const courses = useQuery({
    queryKey: ["courses", user?.id],
    queryFn: async () =>
      (await supabase.from("courses").select("moodle_course_id, short_name, full_name").order("full_name")).data ?? [],
    enabled: !!user,
  });
  const settings = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () =>
      (await supabase.from("user_settings").select("timezone, hidden_course_ids, explicit_deadline_marker_only").maybeSingle()).data,
    enabled: !!user,
  });
  const [hidden, setHidden] = useState<number[]>([]);
  useEffect(() => {
    if (settings.data?.hidden_course_ids) setHidden(settings.data.hidden_course_ids);
  }, [settings.data?.hidden_course_ids]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!user) throw new Error("no_user");
      const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNotice("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
    onError: () => setNotice("We couldn't save that. Please try again."),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectElearn(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  const state = connection.data;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Menu</h1>
      <SetupNudges />

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="surface-card px-4">
        <AccordionItem value="connection">
          <AccordionTrigger>eLearn connection</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {state?.connected ? (
              <>
                <dl className="space-y-1 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd>{state.accountName ?? "Connected"}</dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted-foreground">Last saved refresh</dt>
                    <dd>{state.lastSuccessAt ? formatDateTime(state.lastSuccessAt) : "Not yet"}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <Link to="/connect">Reconnect with a new link</Link>
                  </Button>
                  <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    {disconnect.isPending ? "Disconnecting…" : "Disconnect and delete synced data"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Connect to get personal updates from your own eLearn.</p>
                <Button asChild>
                  <Link to="/connect">Connect eLearn</Link>
                </Button>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="courses" id="courses">
          <AccordionTrigger>My courses</AccordionTrigger>
          <AccordionContent>
            <MyCourses />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reminders" id="home-screen">
          <AccordionTrigger>Reminders and home screen</AccordionTrigger>
          <AccordionContent>
            <ReminderSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="display">
          <AccordionTrigger>Display</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Time zone</Label>
              <Select value={settings.data?.timezone ?? DEFAULT_TIMEZONE} onValueChange={(v) => save.mutate({ timezone: v })}>
                <SelectTrigger id="timezone" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="marker-only">Only trust dates marked #deadline#</Label>
                <p className="mt-1 text-xs text-muted-foreground">Ignore dates written loosely in eLearn course text.</p>
              </div>
              <Switch
                id="marker-only"
                checked={settings.data?.explicit_deadline_marker_only ?? false}
                onCheckedChange={(c) => save.mutate({ explicit_deadline_marker_only: c })}
              />
            </div>
            {!!courses.data?.length && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Hide eLearn courses</p>
                <ul className="space-y-2">
                  {courses.data.map((course) => (
                    <li key={course.moodle_course_id} className="flex items-center gap-3">
                      <Checkbox
                        id={`course-${course.moodle_course_id}`}
                        checked={hidden.includes(course.moodle_course_id)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...hidden, course.moodle_course_id]
                            : hidden.filter((id) => id !== course.moodle_course_id);
                          setHidden(next);
                          save.mutate({ hidden_course_ids: next });
                        }}
                      />
                      <Label htmlFor={`course-${course.moodle_course_id}`} className="text-sm font-normal">
                        {course.short_name || course.full_name}
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dots">
          <AccordionTrigger>What the dots mean</AccordionTrigger>
          <AccordionContent>
            <ConfidenceLegend />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="help">
          <AccordionTrigger>Help and troubleshooting</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <dl className="space-y-3 text-sm">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
            <ConnectionTroubleshooting />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

      <div className="surface-card divide-y divide-border">
        {access.data?.isAdmin && (
          <Link to="/admin" className="tap-target flex items-center gap-3 p-4 text-sm font-medium">
            <ShieldCheck className="size-4" aria-hidden /> Admin
          </Link>
        )}
        <button type="button" onClick={signOut} className="tap-target flex w-full items-center gap-3 p-4 text-left text-sm font-medium">
          <LogOut className="size-4" aria-hidden /> Sign out
          <span className="ml-auto text-xs font-normal text-muted-foreground">Keeps your eLearn connection</span>
        </button>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target flex items-center gap-3 p-4 text-sm font-medium"
        >
          <MessageCircle className="size-4" aria-hidden /> Text Kirt on WhatsApp
        </a>
      </div>
    </div>
  );
}
