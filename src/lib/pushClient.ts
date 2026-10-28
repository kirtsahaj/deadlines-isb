import { VAPID_PUBLIC_KEY, b64urlToBytes } from "./push/vapid";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./push.functions";
import { enableAllAlerts } from "./alerts.functions";

export const REMINDER_SETUP_KEY = "isb-deadline-tracker-show-reminder-setup";

export type PushSupport = "supported" | "needs-home-screen" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "needs-home-screen";
  return ok ? "supported" : "unsupported";
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Must run from a tap: asks permission, subscribes, saves, and sends a confirmation push. */
export async function enableReminders(): Promise<"enabled" | "denied" | "unsupported"> {
  if (pushSupport() !== "supported") return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64urlToBytes(VAPID_PUBLIC_KEY),
  }));
  const json = sub.toJSON();
  await savePushSubscription({ data: { endpoint: sub.endpoint, p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "" } });
  // Turning notifications on for a device always switches Assignments, Classes and Placements alerts on.
  await enableAllAlerts().catch(() => undefined);
  void sendTestPush().catch(() => undefined);
  return "enabled";
}

export async function disableReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await removePushSubscription({ data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
