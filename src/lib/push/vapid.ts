/** Public VAPID key (safe in the browser). The private half lives in VAPID_PRIVATE_KEY_D. */
export const VAPID_PUBLIC_KEY =
  "BFd_0DzYr2sbIUk0YzzGpqFMeVORnBCDehI-KE8XGA0r-6U77-epWCvOXev3IwsoDgb_PIvj00I5WtLHGZtX9Hc";

/** Reminders fire this long before a deadline. */
export const REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;

export function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const bin = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A deadline is due for its reminder once it is within the lead window and still in the future. */
export function isReminderDue(dueAt: Date, now: Date): boolean {
  const left = dueAt.getTime() - now.getTime();
  return left > 0 && left <= REMINDER_LEAD_MS;
}
