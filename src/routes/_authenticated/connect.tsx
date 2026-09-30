import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectionGuide } from "@/components/ConnectionGuide";
import { parseElearnConnectionCode } from "@/lib/parseElearnConnectionCode";
import { connectElearn } from "@/lib/elearn.functions";
import { INSTALL_DISMISSED_KEY, INSTALL_READY_KEY } from "@/lib/installPrompt";

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "Connect eLearn — ISB Deadline Tracker" },
      {
        name: "description",
        content:
          "Five short steps to link your eLearn coursework, read-only and without a password.",
      },
      { property: "og:title", content: "Connect eLearn — ISB Deadline Tracker" },
      {
        property: "og:description",
        content:
          "Five short steps to link your eLearn coursework, read-only and without a password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectPage,
});

const MESSAGES: Record<string, string> = {
  invalid_connection_code:
    "That doesn't look like a connection code. Copy the whole red line from the Console and try again.",
  invalid_elearn_key:
    "eLearn didn't accept that code. It may have expired — repeat the steps to get a fresh one.",
  network: "We couldn't reach eLearn just now. Please try again in a moment.",
  timeout: "eLearn took too long to answer. Please try again in a moment.",
  rate_limited: "eLearn is busy right now. Please wait a minute and try again.",
  request_failed: "Something went wrong setting up your connection. Please try again.",
};

function ConnectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (raw: string) => {
      const token = parseElearnConnectionCode(raw);
      return connectElearn({ data: { token } });
    },
    onSuccess: async (result) => {
      setValue("");
      if (!result.connected) {
        setError(MESSAGES[result.error ?? ""] ?? MESSAGES["request_failed"]!);
        return;
      }
      if (result.firstSync === "success" || result.firstSync === "partial") {
        window.localStorage.setItem(INSTALL_READY_KEY, "true");
        window.localStorage.removeItem(INSTALL_DISMISSED_KEY);
      }
      if (result.firstSync === "failed") {
        window.sessionStorage.setItem(
          "deadline-tracker-sync-notice",
          "eLearn could not complete the first refresh. Your connection is saved; use Refresh now shortly.",
        );
      } else if (result.firstSync === "partial") {
        window.sessionStorage.setItem(
          "deadline-tracker-sync-notice",
          "Some eLearn sections were unavailable. Available dates are ready, and existing dates remain available.",
        );
      }
      await queryClient.invalidateQueries();
      void navigate({ to: "/deadlines" });
    },
    onError: (caught: unknown) => {
      setValue("");
      const code = caught instanceof Error ? caught.message : "request_failed";
      setError(MESSAGES[code] ?? MESSAGES["request_failed"]!);
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Connect your eLearn coursework</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          This takes about two minutes on a laptop, once. Your password is never requested and the
          tracker can only read your coursework.
        </p>
      </header>

      <ConnectionGuide />

      <form
        className="surface-card space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          mutation.mutate(value);
        }}
      >
        <Label htmlFor="connection-code">eLearn connection code</Label>
        <Textarea
          id="connection-code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder="moodlemobile://token=…"
          className="font-mono text-xs"
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          aria-describedby="connection-code-help"
        />
        <p id="connection-code-help" className="text-xs text-muted-foreground">
          This value is as sensitive as a password. Paste it only here. Never put it in chat, email,
          screenshots, analytics, logs, or support messages. If you share it anywhere else, do not
          use it—generate a fresh one. It is decoded only in browser memory, cleared immediately,
          and only the read-only key is sent securely.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="tap-target" disabled={!value.trim() || mutation.isPending}>
          {mutation.isPending ? "Connecting…" : "Connect and load my deadlines"}
        </Button>
      </form>
    </div>
  );
}
