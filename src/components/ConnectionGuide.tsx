import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { createElearnLaunchUrl } from "@/lib/elearnLaunch";
import copyLinkAsset from "@/assets/01-elearn-copy-link-overlay.png.asset.json";
import { ChromeUrlActions, PhoneChromeGuidance, usePhoneBrowser } from "@/components/PhoneChromeGuidance";
import { chromeOpenUrl } from "@/lib/phoneBrowser";

export function ConnectionGuide() {
  const browser = usePhoneBrowser();
  return (
    <div className="space-y-6">
    <PhoneChromeGuidance />
    {browser?.chrome && <p className="text-sm text-muted-foreground">Use this Chrome tab for setup. Open eLearn in Chrome too.</p>}
    <ol className="connection-steps">
      <li className="connection-step">
        <span className="connection-step-number">1</span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold">Open eLearn</h3>
          <p className="text-sm text-muted-foreground">Sign in with your ISB Microsoft account if asked.</p>
          <Button onClick={() => {
            const url = createElearnLaunchUrl();
            if (browser && !browser.chrome) {
              window.location.assign(chromeOpenUrl(url, browser.platform));
              return;
            }
            window.open(url, "_blank", "noopener,noreferrer");
          }} className="tap-target">
            Open eLearn <ArrowUpRight className="size-4" />
          </Button>
          {browser && <ChromeUrlActions browser={browser} getUrl={createElearnLaunchUrl} copyLabel="Copy setup URL" />}
        </div>
      </li>
      <li className="connection-step">
        <span className="connection-step-number">2</span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-lg font-semibold">Copy the eLearn connection link</h3>
          <p className="text-sm text-muted-foreground">
            {browser ? <>Hold <strong>“Click here if the app does not open automatically.”</strong> and choose <strong>{browser.platform === "ios" ? "Copy Link" : "Copy link address"}</strong> in Chrome.</> : <>Right-click <strong>“Click here if the app does not open automatically.”</strong> and choose <strong>Copy Link Address</strong>.</>} If a Moodle app prompt appears, cancel it.
          </p>
          <p className="text-sm text-muted-foreground">Copy the link’s address — not its words or the browser’s page URL.</p>
          <img src={copyLinkAsset.url} alt="Desktop Chrome example: right-click the eLearn launch link and choose Copy Link Address. The instructional menu is an added overlay." width={988} height={454} loading="lazy" className="guide-image" />
          {browser && <p className="text-xs text-muted-foreground">Desktop Chrome shown; on your phone, hold the same link.</p>}
        </div>
      </li>
      <li className="connection-step">
        <span className="connection-step-number">3</span>
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-semibold">Paste and connect</h3>
          <p className="text-sm text-muted-foreground">{browser ? "Return to this tracker in Chrome" : "Return here"} and tap Paste and connect. Allow pasting if asked.</p>
        </div>
      </li>
    </ol>
    {browser && <p className="text-xs text-muted-foreground">Once connected, you can use your preferred browser or home-screen app. Sign in with the same Microsoft account.</p>}
    </div>
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
          <p>Open this tracker in the Google Chrome app and sign in. Tap Open eLearn and log in there in Chrome. Hold the launch link, then choose Copy Link on iPhone or Copy link address on Android. Return to Chrome and tap Paste and connect. Cancel any Moodle app prompt.</p>
          <p>If Safari opens instead, copy the setup URL and paste it into Chrome. If you’re still stuck, complete setup on a laptop. Once connected, use any browser or your home-screen app with the same Microsoft account.</p>
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
