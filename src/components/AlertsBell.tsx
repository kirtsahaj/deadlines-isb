import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAlertSettings, setAlertSetting } from "@/lib/alerts.functions";
import { ALERT_LABELS, type AlertCategory, type AlertSettings } from "@/lib/alerts";
import { currentSubscription, enableReminders, pushSupport } from "@/lib/pushClient";

export const ALERT_SETTINGS_KEY = ["alert-settings"] as const;

// Last known "this device gets notifications", so switching tabs doesn't flash the off state while it re-checks.
const DEVICE_KEY = "alerts-device-on-v1";
let deviceCache: boolean | null = null;
function lastKnownDevice(): boolean | null {
  if (deviceCache !== null) return deviceCache;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    return raw === "1" ? true : raw === "0" ? false : null;
  } catch {
    return null;
  }
}
function rememberDevice(on: boolean) {
  deviceCache = on;
  try {
    window.localStorage.setItem(DEVICE_KEY, on ? "1" : "0");
  } catch {
    /* this session only */
  }
}

/**
 * One bell per section. On only when this device can receive notifications and the section is on.
 * Turning it on from a device without notifications asks permission once and switches every section on.
 */
export function AlertsBell({ category }: { category: AlertCategory }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ALERT_SETTINGS_KEY, queryFn: () => getAlertSettings() });
  const [deviceOn, setDeviceOnState] = useState<boolean | null>(lastKnownDevice);
  const setDeviceOn = (value: boolean) => {
    rememberDevice(value);
    setDeviceOnState(value);
  };
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void currentSubscription()
      .catch(() => null)
      .then((sub) => {
        setDeviceOn(!!sub && "Notification" in window && Notification.permission === "granted");
        setChecked(true);
      });
  }, []);
  const sectionOn = settings.data?.[category];
  // Until both are known, show a plain grey bell rather than a red "off".
  const known = sectionOn !== undefined && deviceOn !== null;
  const on = !!sectionOn && !!deviceOn;
  const label = ALERT_LABELS[category];

  async function save(enabled: boolean) {
    await setAlertSetting({ data: { category, enabled } });
    queryClient.setQueryData(ALERT_SETTINGS_KEY, (old: AlertSettings | undefined) => (old ? { ...old, [category]: enabled } : old));
  }

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await save(false);
        toast(`${label} off`);
        return;
      }
      if (!deviceOn) {
        const support = pushSupport();
        if (support === "needs-home-screen") return void toast("Add the app to your home screen to get alerts");
        if (support === "unsupported") return void toast("This browser can't show notifications");
        const result = await enableReminders();
        if (result === "denied") return void toast("Notifications are blocked. Allow them in your settings, then try again.");
        if (result !== "enabled") return void toast("Couldn't turn on notifications. Please try again.");
        setDeviceOn(true);
        await queryClient.invalidateQueries({ queryKey: ALERT_SETTINGS_KEY });
        toast(`${label} on`);
        return;
      }
      await save(true);
      toast(`${label} on`);
    } catch {
      toast(`Couldn't change ${label.toLowerCase()}. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  const Icon = on || !known ? Bell : BellOff;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`size-10 shrink-0 rounded-full bg-card disabled:opacity-100 ${on || !known ? "text-muted-foreground" : "text-destructive"}`}
      onClick={toggle}
      disabled={busy || !known || !checked}
      aria-pressed={on}
      aria-label={on ? `${label} on. Tap to turn off` : `${label} off. Tap to turn on`}
      title={on ? `${label} on` : `${label} off`}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
