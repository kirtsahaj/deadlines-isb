import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/lib/useSession";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { APP_URL } from "@/components/ShareButton";

/**
 * Email preferences for Kirt's daily batch mails (job deadlines digest, birthday reminder).
 * Standalone page, not part of the app shell: people confirm their ISB email with Microsoft
 * (only to prove the address is theirs), then unsubscribe from one or both mails and/or hide their
 * own birthday from the birthday mail ("hide_birthday" row, same table).
 * Opt-outs live in public.email_unsubscribes (email + mail), readable/writable only by that email.
 */
type MailKey = "jobs" | "birthday" | "hide_birthday";

const MAILS: { key: MailKey; name: string; detail: string; kind: "mail" | "hide" }[] = [
  { key: "jobs", name: "Job deadlines digest", detail: "10 PM, only when an application closes in the next 24 hours", kind: "mail" },
  { key: "birthday", name: "Birthday reminder mail", detail: "Daily list of upcoming birthdays", kind: "mail" },
  { key: "hide_birthday", name: "Hide my birthday", detail: "Leave me out of the Birthday reminder mail", kind: "hide" },
];
const isMail = (k: MailKey) => MAILS.find((m) => m.key === k)!.kind === "mail";

export const Route = createFileRoute("/email-settings")({
  validateSearch: (search: Record<string, unknown>): { mail?: MailKey } => {
    const mail = search["mail"];
    return mail === "jobs" || mail === "birthday" || mail === "hide_birthday" ? { mail } : {};
  },
  head: () => ({
    meta: [
      { title: "Email preferences" },
      { name: "description", content: "Unsubscribe from the daily job deadlines digest or birthday reminder mail." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailSettings,
});

const isIsbEmail = (email: string) => /^[^@]+@isb\.edu$/i.test(email);

function EmailSettings() {
  const { mail } = Route.useSearch();
  const { session, loading } = useSession();
  const queryClient = useQueryClient();
  const email = (session?.user.email ?? "").toLowerCase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<MailKey>>(() => new Set(mail ? [mail] : []));
  const [done, setDone] = useState<MailKey[] | null>(null);

  const unsubscribed = useQuery({
    queryKey: ["email-unsubscribes", email],
    enabled: !!email && isIsbEmail(email),
    queryFn: async () => {
      const { data, error } = await supabase.from("email_unsubscribes").select("mail").eq("email", email);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.mail as MailKey));
    },
  });

  // Pre-tick the mail they came from, unless they've already left it.
  useEffect(() => {
    if (!unsubscribed.data) return;
    setChosen((prev) => new Set([...prev].filter((k) => !unsubscribed.data.has(k))));
  }, [unsubscribed.data]);

  async function confirmEmail(selectAccount = false) {
    setBusy(true);
    setError(null);
    if (selectAccount) await supabase.auth.signOut();
    const back = `${window.location.origin}/email-settings${mail ? `?mail=${mail}` : ""}`;
    const result = await lovable.auth.signInWithOAuth("microsoft", {
      redirect_uri: back,
      ...(selectAccount ? { extraParams: { prompt: "select_account" } } : {}),
    });
    if (result.error) setError("That didn't go through. Please try again.");
    if (!result.redirected) setBusy(false);
  }

  async function setSubscribed(keys: MailKey[], subscribed: boolean) {
    setBusy(true);
    setError(null);
    const { error } = subscribed
      ? await supabase.from("email_unsubscribes").delete().eq("email", email).in("mail", keys)
      : await supabase.from("email_unsubscribes").upsert(keys.map((k) => ({ email, mail: k })), { onConflict: "email,mail" });
    setBusy(false);
    if (error) {
      setError("Couldn't save that. Please try again.");
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["email-unsubscribes", email] });
    return true;
  }

  async function unsubscribe() {
    const keys = [...chosen];
    if (await setSubscribed(keys, false)) setDone(keys);
  }

  async function resubscribe(key: MailKey) {
    if (await setSubscribed([key], true)) setDone((prev) => (prev ? prev.filter((k) => k !== key) : prev));
  }

  const left = unsubscribed.data ?? new Set<MailKey>();
  const names = (keys: MailKey[]) => keys.map((k) => MAILS.find((m) => m.key === k)!.name).join(" and ");
  const stillGetting = useMemo(() => MAILS.filter((m) => m.kind === "mail" && !left.has(m.key)), [left]);
  const doneMails = (done ?? []).filter(isMail);
  const doneHidden = (done ?? []).includes("hide_birthday");

  const renderItem = (m: (typeof MAILS)[number]) =>
    left.has(m.key) ? (
      <li key={m.key} className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.kind === "mail" ? "Unsubscribed" : "Your birthday is hidden"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void resubscribe(m.key)} disabled={busy}>
          {m.kind === "mail" ? "Resubscribe" : "Show it again"}
        </Button>
      </li>
    ) : (
      <li key={m.key}>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            className="mt-0.5"
            checked={chosen.has(m.key)}
            onCheckedChange={(v) =>
              setChosen((prev) => {
                const next = new Set(prev);
                if (v) next.add(m.key);
                else next.delete(m.key);
                return next;
              })
            }
          />
          <span>
            <span className="block text-sm font-semibold">{m.name}</span>
            <span className="block text-xs text-muted-foreground">{m.detail}</span>
          </span>
        </label>
      </li>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <main
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 2.5rem)" }}
      >
        <MailCheck className="mb-5 size-9 text-primary" aria-hidden />
        <h1 className="text-3xl font-semibold">Email preferences</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For the daily mails from Kirt
        </p>

        <section className="surface-card mt-6 space-y-4 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !session ? (
            <>
              <p className="text-sm">
                To make sure only you can change these, please confirm your ISB email with Microsoft. This only confirms
                your address.
              </p>
              <Button className="tap-target w-full" onClick={() => void confirmEmail()} disabled={busy}>
                {busy ? "Opening Microsoft…" : "Confirm my ISB email"}
              </Button>
            </>
          ) : !isIsbEmail(email) ? (
            <>
              <p className="text-sm">
                You're signed in as <span className="font-medium">{email || "an unknown account"}</span>. Please use your
                @isb.edu account.
              </p>
              <Button className="tap-target w-full" onClick={() => void confirmEmail(true)} disabled={busy}>
                Use my ISB account
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">
                Confirmed: <span className="font-medium break-all">{email}</span>{" "}
                <button type="button" className="text-muted-foreground underline" onClick={() => void confirmEmail(true)} disabled={busy}>
                  Not you?
                </button>
              </p>

              {done ? (
                <div className="space-y-3">
                  <p className="text-base font-semibold">
                    {doneMails.length > 0 && `You're unsubscribed from the ${names(doneMails)}. `}
                    {doneHidden && "Your birthday won't appear in the Birthday reminder mail."}
                    {!doneMails.length && !doneHidden && "No changes made."}
                  </p>
                  {stillGetting.length > 0 && (
                    <p className="text-sm text-muted-foreground">You'll still get the {names(stillGetting.map((m) => m.key))}.</p>
                  )}
                  {done && done.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {done.map((k) => (
                        <Button key={k} variant="outline" size="sm" onClick={() => void resubscribe(k)} disabled={busy}>
                          {isMail(k) ? `Resubscribe${doneMails.length > 1 ? ` to ${names([k])}` : ""}` : "Show my birthday again"}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : unsubscribed.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Unsubscribe me from:</p>
                  <ul className="space-y-3">{MAILS.filter((m) => m.kind === "mail").map(renderItem)}</ul>
                  <ul className="space-y-3 border-t border-border pt-4">{MAILS.filter((m) => m.kind === "hide").map(renderItem)}</ul>
                  {MAILS.some((m) => !left.has(m.key)) && (
                    <div className="flex items-center gap-3 pt-1">
                      <Button className="tap-target" onClick={() => void unsubscribe()} disabled={busy || chosen.size === 0}>
                        {busy ? "Saving…" : [...chosen].some(isMail) ? "Unsubscribe" : "Save"}
                      </Button>
                      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setDone([])}>
                        Keep everything
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-md px-4 pb-8" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
        <p className="text-xs text-muted-foreground">
          Track all your deadlines (assignments, prereads and job applications) in one place on the ISB Deadline Tracker:{" "}
          <a href={APP_URL} className="underline">
            deadlines-isb.lovable.app
          </a>
        </p>
      </footer>
    </div>
  );
}
