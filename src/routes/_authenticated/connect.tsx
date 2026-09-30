import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectionGuide } from "@/components/ConnectionGuide";
import { parseElearnConnectionCode } from "@/lib/parseElearnConnectionCode";
import { connectElearn } from "@/lib/elearn.functions";

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
        <Label htmlFor="connection-code">Paste your connection code</Label>
        <Textarea
          id="connection-code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder="Failed to launch 'moodlemobile://token=…'"
          className="font-mono text-xs"
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          aria-describedby="connection-code-help"
        />
        <p id="connection-code-help" className="text-xs text-muted-foreground">
          Hidden as you paste, used once in your browser, and cleared immediately. Only a read-only
          key is sent on — the rest of the line is discarded.
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
