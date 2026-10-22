import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
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

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const FAQ = [
  {
    q: "Where do these dates come from?",
    a: "Your own eLearn (when connected), course updates seen on classmates' eLearn for your section, and your Term 5 course outlines. Tap the ⓘ button on any card to see exactly which.",
  },
  {
    q: "How sure are these dates?",
    a: "The ⓘ button on every card shows where a date came from and when it was last seen — so you know how fresh it is before relying on it.",
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
            const e = mine.get(c.code);
            if (!e) return null;
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
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
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

      <div className="divide-y divide-border">
        <section className="scroll-mt-24 py-5 first:pt-0">
          <h2 className="mb-3 text-lg font-semibold">eLearn connection</h2>
          <div className="space-y-3">
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
          </div>
        </section>

        <section className="scroll-mt-24 py-5 first:pt-0" id="courses">
          <h2 className="mb-3 text-lg font-semibold">My courses</h2>
          <div>
            <MyCourses />
          </div>
        </section>

        <section className="scroll-mt-24 py-5 first:pt-0" id="home-screen">
          <h2 className="mb-3 text-lg font-semibold">Reminders and home screen</h2>
          <div>
            <ReminderSettings />
          </div>
        </section>

        <section className="scroll-mt-24 py-5 first:pt-0">
          <h2 className="mb-3 text-lg font-semibold">Display</h2>
          <div className="space-y-4">
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
          </div>
        </section>

        <section className="scroll-mt-24 py-5 first:pt-0">
          <h2 className="mb-3 text-lg font-semibold">Help and troubleshooting</h2>
          <Accordion type="multiple" className="space-y-3">
            {FAQ.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="rounded-xl border px-4 last:border-b">
                <AccordionTrigger className="text-sm font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-3">
            <ConnectionTroubleshooting />
          </div>
        </section>
      </div>

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

      <div className="divide-y divide-border border-t border-border">
        {access.data?.isAdmin && (
          <Link to="/admin" className="tap-target flex items-center gap-3 p-4 text-sm font-medium">
            <ShieldCheck className="size-4" aria-hidden /> Admin
          </Link>
        )}
        <Button variant="ghost" type="button" onClick={signOut} className="tap-target flex h-auto w-full flex-wrap justify-start gap-3 rounded-none p-4 text-left text-sm font-medium">
          <LogOut className="size-4" aria-hidden /> Sign out
          <span className="ml-auto text-xs font-normal text-muted-foreground">Keeps your eLearn connection</span>
        </Button>
        <div className="p-4">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-semibold transition-colors hover:bg-success/20"
          >
            <WhatsAppIcon className="size-6 shrink-0 text-success" />
            <span className="min-w-0 flex-1">
              <span className="underline decoration-success decoration-2 underline-offset-2">Message Kirt on WhatsApp</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                For any support, feedback or feature requests — just say hi.
              </span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
