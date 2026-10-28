/**
 * Android/desktop Chrome hands over a one-time "install app" prompt early in the page's life.
 * Keep it here (imported once from the root) so the bell can offer "Install app" later.
 * iPhone never fires this; it needs Share → Add to Home Screen instead.
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
  });
}

export const canInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}
