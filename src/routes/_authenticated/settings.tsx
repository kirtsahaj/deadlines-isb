import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { deleteAccount, disconnectElearn, getConnectionState } from "@/lib/elearn.functions";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/format";
import { InstallInstructions } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ISB Deadline Tracker" },
      {
        name: "description",
        content:
          "Manage your eLearn connection, display preferences, hidden courses and your data.",
      },
      { property: "og:title", content: "Settings — ISB Deadline Tracker" },
      {
        property: "og:description",
        content: "Manage your eLearn connection, display preferences and your data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"];

function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const connection = useQuery({
    queryKey: ["connection-state"],
    queryFn: () => getConnectionState(),
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
  const settings = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("timezone, sort_order, hidden_course_ids, explicit_deadline_marker_only")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [hidden, setHidden] = useState<number[]>([]);
  useEffect(() => {
    if (settings.data?.hidden_course_ids) setHidden(settings.data.hidden_course_ids);
  }, [settings.data?.hidden_course_ids]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!user) throw new Error("no_user");
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
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
      void navigate({ to: "/connect" });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteAccount({ data: { confirmation } }),
    onSuccess: async (result) => {
      if (!result.deleted) {
        setNotice("Type DELETE MY ACCOUNT exactly to confirm.");
        return;
      }
      await supabase.auth.signOut();
      queryClient.clear();
      void navigate({ to: "/", replace: true });
    },
  });

  const state = connection.data;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your connection, how deadlines are shown, and control over your data.
        </p>
      </header>

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-lg font-semibold">eLearn connection</h2>
        {state?.connected ? (
          <>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">eLearn account</dt>
                <dd>{state.accountName ?? "Connected"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Last successful refresh</dt>
                <dd>{state.lastSuccessAt ? formatDateTime(state.lastSuccessAt) : "Not yet"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Next background refresh</dt>
                <dd>{state.nextSyncAt ? formatDateTime(state.nextSyncAt) : "Soon"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="tap-target">
                <Link to="/connect">Reconnect with a new code</Link>
              </Button>
              <Button
                variant="outline"
                className="tap-target"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? "Disconnecting…" : "Disconnect and delete synced data"}
              </Button>
            </div>
          </>
        ) : (
          <Button asChild className="tap-target">
            <Link to="/connect">Connect eLearn</Link>
          </Button>
        )}
      </section>

      <section className="surface-card space-y-4 p-4">
        <h2 className="text-lg font-semibold">Display</h2>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Time zone</Label>
          <Select
            value={settings.data?.timezone ?? DEFAULT_TIMEZONE}
            onValueChange={(value) => save.mutate({ timezone: value })}
          >
            <SelectTrigger id="timezone" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sort">Sort deadlines</Label>
          <Select
            value={settings.data?.sort_order ?? "latest_first"}
            onValueChange={(value) => save.mutate({ sort_order: value })}
          >
            <SelectTrigger id="sort" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest_first">Latest date first</SelectItem>
              <SelectItem value="earliest_first">Earliest date first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="marker-only">Only trust dates marked #deadline#</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Ignore dates written loosely in course text unless a teacher tagged them.
            </p>
          </div>
          <Switch
            id="marker-only"
            checked={settings.data?.explicit_deadline_marker_only ?? false}
            onCheckedChange={(checked) => save.mutate({ explicit_deadline_marker_only: checked })}
          />
        </div>
      </section>

      <section className="surface-card p-4">
        <InstallInstructions />
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="text-lg font-semibold">Hide courses</h2>
        <p className="text-sm text-muted-foreground">
          Hidden courses stay out of your deadline list.
        </p>
        <ul className="space-y-2">
          {(courses.data ?? []).map((course) => (
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
          {!courses.data?.length && (
            <li className="text-sm text-muted-foreground">No courses synced yet.</li>
          )}
        </ul>
      </section>

      <section className="surface-card space-y-3 border-destructive/30 p-4">
        <h2 className="text-lg font-semibold">Delete your account</h2>
        <p className="text-sm text-muted-foreground">
          This permanently removes your account, your eLearn connection and every synced deadline.
          It cannot be undone. Type <strong>DELETE MY ACCOUNT</strong> to confirm.
        </p>
        <Input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE MY ACCOUNT"
          aria-label="Type DELETE MY ACCOUNT to confirm"
        />
        <Button
          variant="destructive"
          className="tap-target"
          disabled={confirmation !== "DELETE MY ACCOUNT" || remove.isPending}
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? "Deleting…" : "Delete my account permanently"}
        </Button>
      </section>

      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <section className="border-t border-border pt-6">
        <Button type="button" variant="outline" className="tap-target" onClick={signOut}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Signing out does not disconnect eLearn or remove your saved deadlines.
        </p>
      </section>
    </div>
  );
}
