import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { createElearnLaunchUrl } from "@/lib/elearnLaunch";
import copyLinkAsset from "@/assets/01-elearn-copy-link-overlay.png.asset.json";

export function ConnectionGuide() {
  return (
    <ol className="connection-steps">
      <li className="connection-step">
        <span className="connection-step-number">1</span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold">Open eLearn</h3>
          <p className="text-sm text-muted-foreground">Sign in with your ISB Microsoft account if asked.</p>
          <Button onClick={() => window.open(createElearnLaunchUrl(), "_blank", "noopener,noreferrer")} className="tap-target">
            Open eLearn <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </li>
      <li className="connection-step">
        <span className="connection-step-number">2</span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold">Copy the eLearn connection link</h3>
          <p className="text-sm text-muted-foreground">
            Right-click <strong>“Click here if the app does not open automatically.”</strong> and choose <strong>Copy Link Address</strong>. If a Moodle app prompt appears, cancel it.
          </p>
          <p className="text-sm text-muted-foreground">Copy the link’s address — not its words or the browser’s page URL.</p>
          <img src={copyLinkAsset.url} alt="Desktop Chrome example: right-click the eLearn launch link and choose Copy Link Address. The instructional menu is an added overlay." width={988} height={454} loading="lazy" className="guide-image" />
        </div>
      </li>
      <li className="connection-step">
        <span className="connection-step-number">3</span>
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-semibold">Paste and connect</h3>
          <p className="text-sm text-muted-foreground">Return here and tap Paste and connect. Allow pasting if asked.</p>
        </div>
      </li>
    </ol>
  );
}

export function ConnectionTroubleshooting() {
  const [copied, setCopied] = useState(false);
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(createElearnLaunchUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="phone">
        <AccordionTrigger>On a phone?</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>Try long-pressing the same link and choosing Copy Link (the menu varies by browser). Cancel any Moodle app prompt. If that doesn't work, complete setup on a laptop — then use the tracker on your phone.</p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="troubleshooting">
        <AccordionTrigger>Something not working?</AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>Don't see the link?</strong> Make sure you're signed in to eLearn, then open eLearn again. Or copy the setup address and paste it into a new browser tab:</p>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy setup address"}
          </Button>
          <p><strong>Link not accepted?</strong> Copy the link's address, not its text. It starts with moodlemobile://. Each link works once — open eLearn again for a fresh one.</p>
          <p><strong>Already connected?</strong> Reconnecting keeps your saved deadlines.</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
