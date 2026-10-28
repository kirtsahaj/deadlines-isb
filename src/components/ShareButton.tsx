import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const APP_URL = "https://deadlines-isb.lovable.app";

/**
 * Top-right share button on each main tab. Phones open their own share sheet with the
 * app link and a message that fits the tab; without a share sheet (most laptops) the
 * link is copied instead.
 */
export function ShareButton({ message }: { message: string }) {
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
