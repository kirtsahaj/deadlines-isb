import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const APP_URL = "https://deadlines-isb.lovable.app";
/** The one share message, used by the tab share buttons and the Menu tile. */
export const SHARE_MESSAGE =
  "ISB Deadline Tracker: assignments, classes & prereads and CAS job postings, all in one place. Sign in with your ISB account:";

/**
 * Top-right share button on each main tab. Phones open their own share sheet with the
 * app link and the share message; without a share sheet (most laptops) the link is copied instead.
 */
export function ShareButton() {
  const message = SHARE_MESSAGE;
  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "ISB Deadline Tracker", text: message, url: APP_URL });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${message} ${APP_URL}`);
      toast("Link copied");
    } catch {
      toast(`Couldn't copy. The link is ${APP_URL.replace("https://", "")}`);
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={share}
      className="size-10 shrink-0 rounded-full border-transparent bg-muted text-muted-foreground shadow-none hover:bg-muted/70"
      aria-label="Share the app"
      title="Share the app"
    >
      <Share2 className="size-4" aria-hidden />
    </Button>
  );
}
