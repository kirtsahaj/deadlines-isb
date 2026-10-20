import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REMINDER_SETUP_KEY, currentSubscription, disableReminders, enableReminders, pushSupport, type PushSupport } from "@/lib/pushClient";

function HomeScreenSteps() {
  return (
    <Tabs defaultValue={typeof navigator !== "undefined" && /Android/.test(navigator.userAgent) ? "android" : "ios"}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="ios">iPhone</TabsTrigger>
        <TabsTrigger value="android">Android</TabsTrigger>
      </TabsList>
      <TabsContent value="ios">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Open <strong>deadlines-isb.lovable.app</strong> in <strong>Safari</strong>.</li>
          <li>Tap <strong>Share</strong> (square with an arrow).</li>
          <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
          <li>Open the app from your home screen and tap <strong>Turn on reminders</strong>.</li>
        </ol>
      </TabsContent>
      <TabsContent value="android">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Open <strong>deadlines-isb.lovable.app</strong> in <strong>Chrome</strong>.</li>
          <li>Tap the <strong>⋮</strong> menu.</li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
          <li>Open the app and tap <strong>Turn on reminders</strong>.</li>
        </ol>
      </TabsContent>
    </Tabs>
  );
}

function useReminderState() {
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setSupport(pushSupport());
    void currentSubscription().then((s) => setEnabled(!!s && Notification.permission === "granted"));
  }, []);
  const turnOn = async () => {
    setBusy(true); setMessage(null);
    try {
      const r = await enableReminders();
      if (r === "enabled") { setEnabled(true); setMessage("Reminders are on. A test notification is on its way."); }
      else if (r === "denied") setMessage("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
      else setMessage("This browser can't show reminders. Add the app to your home screen first.");
    } catch { setMessage("Couldn't turn on reminders. Please try again."); }
    finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true);
    try { await disableReminders(); setEnabled(false); setMessage("Reminders are off on this device."); }
    finally { setBusy(false); }
  };
  return { support, enabled, busy, message, turnOn, turnOff };
}

function ReminderActions({ state }: { state: ReturnType<typeof useReminderState> }) {
  if (state.support !== "supported") return null;
  return state.enabled ? (
    <Button variant="outline" onClick={state.turnOff} disabled={state.busy}><BellOff className="size-4" />Turn off on this device</Button>
  ) : (
    <Button onClick={state.turnOn} disabled={state.busy}><Bell className="size-4" />{state.busy ? "Turning on…" : "Turn on reminders"}</Button>
  );
}

/** Shown once after connecting eLearn. */
export function ReminderSetupDialog() {
  const [open, setOpen] = useState(false);
  const state = useReminderState();
  useEffect(() => {
    if (window.localStorage.getItem(REMINDER_SETUP_KEY) === "true") setOpen(true);
  }, []);
  const close = (next: boolean) => {
    if (!next) window.localStorage.removeItem(REMINDER_SETUP_KEY);
    setOpen(next);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Get a nudge 3 hours before</DialogTitle>
          <DialogDescription>Add the tracker to your phone's home screen, then turn on reminders.</DialogDescription>
        </DialogHeader>
        <HomeScreenSteps />
        {state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
        <div className="flex flex-wrap gap-2">
          <ReminderActions state={state} />
          <Button variant="ghost" onClick={() => close(false)}>{state.enabled ? "Done" : "Maybe later"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Settings card. */
export function ReminderSettings() {
  const state = useReminderState();
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
  }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        One notification 3 hours before each deadline.{" "}
        {state.support === "supported" ? (state.enabled ? "On for this device." : "Off for this device.") : "Add the app to your home screen to turn these on."}
      </p>
      <ReminderActions state={state} />
      {state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
      {!installed && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Add it to your phone's home screen</p>
          <HomeScreenSteps />
        </div>
      )}
    </div>
  );
}
