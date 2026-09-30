import { useEffect, useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const LAUNCH_URL =
  "https://elearn.isb.edu/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=12345&urlscheme=moodlemobile";

const STEPS = [
  {
    title: "No password, ever",
    body: "The tracker uses the same read-only web-service key that eLearn issues to Moodle's official mobile app. It never asks for your eLearn password and can only read your coursework.",
    image: "/help/elearn-connect/01-sign-in-to-elearn.png",
    alt: "The eLearn sign-in page in a browser.",
  },
  {
    title: "Sign in to eLearn and stay in that tab",
    body: "Open https://elearn.isb.edu in Chrome or Edge on a laptop and sign in normally. Keep that tab open — every remaining step happens there.",
    image: "/help/elearn-connect/01-sign-in-to-elearn.png",
    alt: "A signed-in eLearn dashboard.",
  },
  {
    title: "Open the developer console",
    body: null,
    image: "/help/elearn-connect/02-open-developer-console.png",
    alt: "Browser developer tools open on the Console tab.",
  },
  {
    title: "Open the connection URL in the same tab",
    body: "Paste the connection URL into the address bar of that same signed-in tab and press Enter. If the browser offers to open the Moodle app, choose Cancel.",
    image: "/help/elearn-connect/03-open-mobile-connection-url.png",
    alt: "The Moodle mobile launch URL typed into the address bar.",
  },
  {
    title: "Copy the red line from the Console",
    body: "In the Console, copy the whole red line that begins “Failed to launch 'moodlemobile://token=…”. That entire line is your connection code.",
    image: "/help/elearn-connect/04-copy-connection-code.png",
    alt: "A red console error containing the moodlemobile token line.",
  },
] as const;

function useAppleKeys() {
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    setIsApple(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);
  return isApple;
}

export function ConnectionGuide() {
  const isApple = useAppleKeys();
  const [copied, setCopied] = useState(false);

  async function copyLaunchUrl() {
    try {
      await navigator.clipboard.writeText(LAUNCH_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldAlert className="size-4" aria-hidden />
        <AlertTitle>Treat your connection code like a password</AlertTitle>
        <AlertDescription>
          Never paste it into chat, email, or a support message. Paste it only into the connection
          field in this app. It is read once in your browser and never saved on your device.
        </AlertDescription>
      </Alert>

      <ol className="space-y-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="surface-card overflow-hidden">
            <div className="flex gap-3 p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <div className="space-y-2">
                <h3 className="text-base font-semibold">{step.title}</h3>
                {step.body ? (
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Press{" "}
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                      {isApple ? "Cmd + Option + J" : "Ctrl + Shift + J"}
                    </kbd>{" "}
                    to open the Console. Leave it open.
                  </p>
                )}
                {index === 3 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={copyLaunchUrl}
                    className="tap-target"
                  >
                    {copied ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Copy className="size-4" aria-hidden />
                    )}
                    {copied ? "Connection URL copied" : "Copy connection URL"}
                  </Button>
                )}
              </div>
            </div>
            <img
              src={step.image}
              alt={step.alt}
              loading="lazy"
              className="w-full border-t border-border bg-muted object-cover"
            />
          </li>
        ))}
      </ol>

      <Accordion type="single" collapsible>
        <AccordionItem value="fallback">
          <AccordionTrigger>Nothing appeared in the Console?</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open the Network tab instead, tick “Preserve log”, open the connection URL again,
              select the <code>launch.php</code> request, and copy the <code>Location</code>{" "}
              response header. That header is also a valid connection code.
            </p>
            <img
              src="/help/elearn-connect/05-network-location-fallback.png"
              alt="The Network tab showing the Location response header for launch.php."
              loading="lazy"
              className="w-full rounded-lg border border-border"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="text-xs text-muted-foreground">
        This app cannot read your eLearn tab, cookies, or console for you — browsers keep sites
        isolated from each other. That is why this one copy step is manual.
      </p>
    </div>
  );
}
