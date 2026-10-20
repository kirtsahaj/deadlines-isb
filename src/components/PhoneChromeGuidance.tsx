import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chromeOpenUrl, detectPhoneBrowser, type PhoneBrowser } from "@/lib/phoneBrowser";

export function usePhoneBrowser() {
  const [browser, setBrowser] = useState<PhoneBrowser | null>(null);
  useEffect(() => {
    setBrowser(detectPhoneBrowser(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  return browser;
}

export function ChromeUrlActions({ browser, getUrl, copyLabel }: {
  browser: PhoneBrowser;
  getUrl: () => string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  async function copy() {
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManualUrl(null);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setManualUrl(url);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!browser.chrome && <Button variant="outline" onClick={() => window.location.assign(chromeOpenUrl(getUrl(), browser.platform))}>
          Open in Chrome <ArrowUpRight className="size-4" />
        </Button>}
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : copyLabel}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">If it doesn’t open, copy the address and paste it into the Google Chrome app.</p>
      {manualUrl && <div className="space-y-1">
        <p role="status" className="text-xs text-muted-foreground">Hold this address to copy it, then open it in Chrome.</p>
        <p className="break-all select-all text-xs text-muted-foreground">{manualUrl}</p>
      </div>}
    </div>
  );
}

export function PhoneChromeGuidance() {
  const browser = usePhoneBrowser();
  if (!browser || browser.chrome) return null;
  return <section className="space-y-3 border-l-2 border-primary pl-4">
    <h2 className="text-base font-semibold">Use Google Chrome for phone setup</h2>
    <p className="text-sm text-muted-foreground">Open this tracker in the Google Chrome app and sign in there. On iPhone, copying the eLearn link works in Chrome, not Safari.</p>
    <ChromeUrlActions browser={browser} getUrl={() => `${window.location.origin}/connect`} copyLabel="Copy tracker address" />
  </section>;
}