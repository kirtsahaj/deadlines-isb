import { useState } from "react";
import { ArrowUpRight, Check, Copy, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { createElearnLaunchUrl } from "@/lib/elearnLaunch";
import copyLinkImage from "@/assets/copy-elearn-link.jpg";

export function ConnectionGuide() {
  const [copied, setCopied] = useState(false);
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(createElearnLaunchUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { setCopied(false); }
  }
  return (
    <div className="space-y-6">
      <ol className="connection-steps">
        <li className="connection-step">
          <span className="connection-step-number">1</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Open eLearn. Sign in as usual.</h3>
            <p className="text-sm text-muted-foreground">Use your ISB Microsoft sign-in. Keep this tracker open in another tab.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.open(createElearnLaunchUrl(), "_blank", "noopener,noreferrer")} className="tap-target">Open eLearn <ArrowUpRight className="size-4" /></Button>
              <Button variant="outline" onClick={copyUrl}><Copy className="size-4" />{copied ? "URL copied" : "Copy setup URL"}</Button>
            </div>
          </div>
        </li>
        <li className="connection-step">
          <span className="connection-step-number">2</span>
          <div className="min-w-0 space-y-3">
            <h3 className="text-lg font-semibold">Copy one link address.</h3>
            <p className="text-sm text-muted-foreground">Find <strong>“Click here if the app does not open automatically.”</strong> Right-click that exact link and choose <strong>Copy Link Address</strong> (or Copy Link). Do not copy its visible words or the page’s address bar.</p>
            <p className="text-sm text-muted-foreground">If asked to open the Moodle app, cancel or choose Stay in browser. If the app opens anyway, return to the browser page and copy the link without clicking it.</p>
            <Accordion type="single" collapsible><AccordionItem value="example"><AccordionTrigger className="text-sm">Show me which link</AccordionTrigger><AccordionContent><img src={copyLinkImage} alt="Illustrative example of the eLearn fallback link and the Copy Link Address menu option, not a live screenshot." width={1280} height={640} loading="lazy" className="guide-image" /></AccordionContent></AccordionItem></Accordion>
          </div>
        </li>
        <li className="connection-step">
          <span className="connection-step-number">3</span>
          <div className="min-w-0 space-y-2">
            <h3 className="text-lg font-semibold">Paste it into the tracker.</h3>
            <p className="text-sm text-muted-foreground">Return here, paste the copied link below, and connect. Your deadlines start loading automatically.</p>
          </div>
        </li>
      </ol>
      <div className="flex items-start gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><LockKeyhole className="size-4 shrink-0" /><p>This link is private, like a password. Paste it only into this tracker. Never share it in chat, email, or screenshots. Only the read-only key is sent securely; the private auto-login key is discarded.</p></div>
      <Accordion type="single" collapsible>
        <AccordionItem value="phone"><AccordionTrigger>Connecting from a phone?</AccordionTrigger><AccordionContent className="space-y-2 text-sm text-muted-foreground"><p>You can try long-pressing the same link and choosing Copy Link or Copy Link Address. Cancel any prompt to open Moodle.</p><p>Physical iPhone and Android behavior has not been verified. If the menu only copies text, the app takes over, or the link is missing, use Chrome or Edge on a laptop for this one-time setup. Then use the tracker on your phone.</p></AccordionContent></AccordionItem>
        <AccordionItem value="troubleshooting"><AccordionTrigger>Something not working?</AccordionTrigger><AccordionContent className="space-y-3 text-sm text-muted-foreground"><p><strong>No fallback link?</strong> Sign in first, then use Open eLearn again. Each attempt opens a fresh setup URL. Try a laptop browser if your phone redirects to Moodle.</p><p><strong>Link not accepted?</strong> Copy the address of the fallback link, not its text or the page URL. It should start with moodlemobile://. Generate a fresh link if it expired or was shared.</p><p><strong>Already connected?</strong> Reconnecting replaces your key without deleting saved deadlines. Signing out does not disconnect eLearn.</p></AccordionContent></AccordionItem>
      </Accordion>
    </div>
  );
}
