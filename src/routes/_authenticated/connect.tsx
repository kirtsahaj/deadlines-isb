import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectionGuide, ConnectionTroubleshooting } from "@/components/ConnectionGuide";
import { parseElearnConnectionCode } from "@/lib/parseElearnConnectionCode";
import { connectElearn } from "@/lib/elearn.functions";
import { INSTALL_DISMISSED_KEY, INSTALL_READY_KEY } from "@/lib/installPrompt";
import { ClipboardPaste } from "lucide-react";
import { connectFromClipboard } from "@/lib/connectFromClipboard";

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({
    meta: [
      { title: "Connect eLearn — ISB Deadline Tracker" },
      {
        name: "description",
        content:
          "Connect your eLearn coursework in three simple steps with a private copied link.",
      },
      { property: "og:title", content: "Connect eLearn — ISB Deadline Tracker" },
      {
        property: "og:description",
        content:
          "Connect your eLearn coursework in three simple steps with a private copied link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectPage,
});

const MESSAGES: Record<string, string> = {
  invalid_connection_code:
    "That isn’t the eLearn connection link. Right-click the link on eLearn, choose Copy Link Address, and paste it here.",
  invalid_elearn_key:
    "eLearn didn’t accept that link. It may have expired — open eLearn again for a fresh one.",
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
  const [manualPaste, setManualPaste] = useState(false);

  const mutation = useMutation({
    mutationFn: async (input: { source: "clipboard" } | { source: "manual"; raw: string }) => {
      if (input.source === "clipboard") {
        return connectFromClipboard(navigator.clipboard, (token) => connectElearn({ data: { token } }));
      }
      const token = parseElearnConnectionCode(input.raw);
      return { kind: "connected" as const, result: await connectElearn({ data: { token } }) };
    },
    onSuccess: async (outcome) => {
      setValue("");
      if (outcome.kind === "manual") {
        setManualPaste(true);
        return;
      }
      const result = outcome.result;
      if (!result.connected) {
        setError(MESSAGES[result.error ?? ""] ?? (MESSAGES["request_failed"] ?? "Please try again."));
        return;
      }
      window.localStorage.setItem(INSTALL_READY_KEY, "true");
      window.localStorage.removeItem(INSTALL_DISMISSED_KEY);
      window.sessionStorage.setItem(
        "deadline-tracker-sync-notice",
        "Connected. Fetching your coursework now — this takes a few seconds.",
      );
      await queryClient.invalidateQueries();
      void navigate({ to: "/deadlines" });
    },

    onError: (caught: unknown) => {
      setValue("");
      const code = caught instanceof Error ? caught.message : "request_failed";
      setError(MESSAGES[code] ?? (MESSAGES["request_failed"] ?? "Please try again."));
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Connect eLearn</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Three quick steps. Your eLearn password is never shared.
        </p>
      </header>

      <ConnectionGuide />

      <div className="space-y-3">
        <Button
          className="tap-target"
          disabled={mutation.isPending}
          onClick={() => {
            setError(null);
            mutation.mutate({ source: "clipboard" });
          }}
        >
          <ClipboardPaste className="size-4" />
          {mutation.isPending ? "Connecting…" : "Paste and connect"}
        </Button>
        <p className="text-xs text-muted-foreground">Keep your eLearn connection link private. Paste it only here.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!manualPaste && (
          <Button variant="link" className="px-0" disabled={mutation.isPending} onClick={() => setManualPaste(true)}>
            Paste manually instead
          </Button>
        )}
      </div>

      {manualPaste && <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const raw = value;
          setValue("");
          mutation.mutate({ source: "manual", raw });
        }}
      >
        <p role="status" className="text-sm text-muted-foreground">Paste your eLearn connection link manually, then connect.</p>
        <Label htmlFor="connection-code">eLearn connection link</Label>
        <Textarea
          id="connection-code"
          autoFocus
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
          Keep this link private. Paste it only here.
        </p>
        <Button type="submit" className="tap-target" disabled={!value.trim() || mutation.isPending}>
          {mutation.isPending ? "Connecting…" : "Connect eLearn"}
        </Button>
      </form>}

      <ConnectionTroubleshooting />
    </div>
  );
}
