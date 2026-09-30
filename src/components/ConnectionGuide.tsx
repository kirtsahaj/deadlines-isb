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
import dashboardImage from "@/assets/01-real-elearn-dashboard.png.asset.json";
import locationImage from "@/assets/02-real-devtools-location-header.png.asset.json";

export const LAUNCH_URL =
  "https://elearn.isb.edu/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=12345&urlscheme=moodlemobile";

export function ConnectionGuide() {
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
    <div className="space-y-5">
      <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
        <p className="font-medium">
          You only need a laptop once to connect eLearn. After setup, you can use the Deadline
          Tracker from your phone without repeating these steps.
        </p>
      </div>
      <Alert>
        <ShieldAlert className="size-4" aria-hidden />
        <AlertTitle>Treat your connection code like a password</AlertTitle>
        <AlertDescription>
          This value is as sensitive as a password. Paste it only here. Never put it in chat, email,
          screenshots, analytics, logs, or support messages. If you share it anywhere else, do not
          use it—generate a fresh one.
        </AlertDescription>
      </Alert>

      <ol className="connection-steps">
        <li className="connection-step">
          <span className="connection-step-number">1</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Sign in on a laptop</h3>
            <p className="text-sm text-muted-foreground">
              Open Chrome or Edge on a laptop or desktop and sign in normally at{" "}
              <a
                className="font-medium text-foreground underline"
                href="https://elearn.isb.edu"
                target="_blank"
                rel="noreferrer"
              >
                elearn.isb.edu
              </a>
              . Stay in the signed-in eLearn tab. Your courses may look different from this example.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <img
                src="/help/elearn-connect/01-sign-in-to-elearn.png"
                alt="The eLearn Microsoft sign-in page."
                loading="lazy"
                className="guide-image"
              />
              <img
                src={dashboardImage.url}
                alt="A privacy-redacted signed-in ISB eLearn dashboard."
                loading="lazy"
                className="guide-image"
              />
            </div>
          </div>
        </li>
        <li className="connection-step">
          <span className="connection-step-number">2</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Open Network tools</h3>
            <p className="text-sm text-muted-foreground">
              Open Developer Tools with <kbd>F12</kbd> or <kbd>Ctrl + Shift + I</kbd> on Windows, or{" "}
              <kbd>Cmd + Option + I</kbd> on Mac. Select <strong>Network</strong>, make sure
              recording is active, and enable <strong>Keep log</strong> or{" "}
              <strong>Preserve log</strong>. The tools may appear on the right or bottom of your
              browser.
            </p>
          </div>
        </li>
        <li className="connection-step">
          <span className="connection-step-number">3</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Open the eLearn connection URL</h3>
            <p className="text-sm text-muted-foreground">
              Copy the URL, paste it into the address bar of the same signed-in eLearn tab, and
              press Enter.
            </p>
            <Button type="button" onClick={copyLaunchUrl} className="tap-target">
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Connection URL copied" : "Copy connection URL"}
            </Button>
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              On a PC, the browser may remain on the eLearn dashboard, show an external-app error,
              or say it cannot open the Moodle app. That is expected. Keep Developer Tools open and
              continue below.
            </p>
          </div>
        </li>
        <li className="connection-step">
          <span className="connection-step-number">4</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Find the connection value</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Find and select the request beginning <code>launch.php</code>. It normally has
                status 302.
              </li>
              <li>
                Open <strong>Headers</strong>.
              </li>
              <li>
                Under <strong>Response Headers</strong>, find <strong>Location</strong>.
              </li>
            </ol>
            <img
              src={locationImage.url}
              alt="Privacy-redacted Chrome Network tools showing the Location response header."
              loading="lazy"
              className="guide-image"
            />
            <p className="text-sm text-muted-foreground">
              Copy the complete Location value, starting with <code>moodlemobile://token=</code> and
              continuing through its final character. If quotation marks appear around it, exclude
              only the surrounding quotation marks and spaces. Do not shorten, edit, or decode the
              value.
            </p>
          </div>
        </li>
      </ol>

      <Accordion type="single" collapsible>
        <AccordionItem value="troubleshooting">
          <AccordionTrigger>Troubleshooting</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                If <code>launch.php</code> is missing, confirm recording is active, Keep/Preserve
                log is enabled, and the URL was opened in the signed-in eLearn tab; then try again.
              </li>
              <li>
                If connection fails, generate a fresh Location value and retry. The submitted value
                is never displayed or echoed.
              </li>
              <li>
                Browsers isolate tabs, so the tracker cannot automatically read eLearn. This
                one-time copy-and-paste is required.
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
