import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INSTALL_DISMISSED_KEY, shouldShowInstallPrompt } from "@/lib/installPrompt";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function platformGuidance() {
  if (typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return "In Safari, tap Share, then Add to Home Screen.";
  }
  return "In Android Chrome, open the browser menu, then choose Install app or Add to Home screen.";
}

export function InstallInstructions({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <p className="text-sm font-medium">Add Deadline Tracker to your phone</p>
      <p className="text-sm text-muted-foreground">
        iPhone or iPad: in Safari, tap Share → Add to Home Screen. Android: in Chrome, open the
        browser menu → Install app or Add to Home screen.
      </p>
    </div>
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    setVisible(shouldShowInstallPrompt(window.localStorage));
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    setVisible(false);
  };

  return (
    <aside className="install-prompt" aria-labelledby="install-title">
      <span className="install-prompt-icon" aria-hidden>
        <Smartphone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="install-title" className="text-base font-semibold">
          Add Deadline Tracker to your phone
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your laptop setup is complete. You can now check deadlines from your phone.
        </p>
        {!installEvent && <p className="mt-2 text-xs text-muted-foreground">{platformGuidance()}</p>}
        {installEvent && (
          <Button
            type="button"
            size="sm"
            className="mt-3 tap-target"
            onClick={async () => {
              await installEvent.prompt();
              const choice = await installEvent.userChoice;
              if (choice.outcome === "accepted") dismiss();
              setInstallEvent(null);
            }}
          >
            <Download className="size-4" aria-hidden />
            Install app
          </Button>
        )}
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss phone prompt">
        <X className="size-4" aria-hidden />
      </Button>
    </aside>
  );
}