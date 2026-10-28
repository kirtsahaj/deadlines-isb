import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Link2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConnectionState } from "@/lib/elearn.functions";

type Nudge = { id: string; icon: typeof Link2; text: string; action: React.ReactNode };

/** One small rotating banner for pending setup steps (eLearn, home screen); each disappears once done. Notifications live on the bells and in Menu. */
export function SetupNudges() {
  const connection = useQuery({ queryKey: ["connection-state"], queryFn: () => getConnectionState() });
  const [phone, setPhone] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setPhone(/iPhone|iPad|iPod|Android/.test(navigator.userAgent));
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
    );
  }, []);

  const nudges = useMemo(() => {
    const list: Nudge[] = [];
    if (connection.data && !connection.data.connected) {
      list.push({
        id: "connect",
        icon: Link2,
        text: "Connect eLearn for personal updates",
        action: (
          <Button asChild size="sm">
            <Link to="/connect">Connect</Link>
          </Button>
        ),
      });
    }
    if (phone && !installed) {
      list.push({
        id: "home",
        icon: Smartphone,
        text: "Add the tracker to your home screen",
        action: (
          <Button asChild size="sm" variant="secondary">
            <Link to="/menu" hash="home-screen">How</Link>
          </Button>
        ),
      });
    }
    return list;
  }, [connection.data, phone, installed]);

  useEffect(() => {
    if (nudges.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % nudges.length), 6000);
    return () => window.clearInterval(t);
  }, [nudges.length]);

  if (!nudges.length) return null;
  const current = nudges[index % nudges.length]!;
  const Icon = current.icon;
  return (
    <section aria-label="Setup steps" className="surface-card flex items-center gap-3 p-3" aria-live="polite">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{current.text}</p>
        {nudges.length > 1 && (
          <div className="mt-1 flex gap-1" aria-hidden>
            {nudges.map((n, i) => (
              <span key={n.id} className={`h-1 w-4 rounded-full ${i === index % nudges.length ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}
      </div>
      {current.action}
      {nudges.length > 1 && (
        <button
          type="button"
          className="tap-target grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Next setup step"
          onClick={() => setIndex((i) => (i + 1) % nudges.length)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
