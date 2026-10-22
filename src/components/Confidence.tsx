import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { Confidence } from "@/lib/term5/model";

export const CONFIDENCE_META: Record<Confidence, { symbol: string; label: string; className: string; explain: string }> = {
  own: {
    symbol: "●",
    label: "Your eLearn, recently refreshed",
    className: "text-conf-own",
    explain: "Comes from your own eLearn and was refreshed recently.",
  },
  shared: {
    symbol: "◐",
    label: "Classmate update for your section",
    className: "text-conf-shared",
    explain: "Seen recently on a classmate's eLearn for your course and section.",
  },
  outline: {
    symbol: "○",
    label: "Outline or older update",
    className: "text-conf-outline",
    explain: "From the course outline or an update that hasn't been confirmed recently.",
  },
  provisional: {
    symbol: "?",
    label: "Estimated or not announced yet",
    className: "text-conf-provisional",
    explain: "Estimated from the outline and class schedule, or not announced yet.",
  },
};

/** Symbol + color, never color alone. */
export function ConfidenceMark({ value, className = "" }: { value: Confidence; className?: string }) {
  const meta = CONFIDENCE_META[value];
  return (
    <span aria-hidden className={`inline-grid size-5 place-items-center text-base font-bold leading-none ${meta.className} ${className}`}>
      {meta.symbol}
    </span>
  );
}

export function ConfidenceLegend() {
  return (
    <ul className="space-y-1.5 text-sm">
      {(Object.keys(CONFIDENCE_META) as Confidence[]).map((k) => (
        <li key={k} className="flex items-start gap-2">
          <ConfidenceMark value={k} />
          <span>
            <span className="font-medium">{CONFIDENCE_META[k].label}.</span>{" "}
            <span className="text-muted-foreground">{CONFIDENCE_META[k].explain}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ConnectCta({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="rounded-xl bg-primary/10 p-3 text-sm">
      <p>Connect your eLearn to get personal updates for your courses, including your own submissions.</p>
      <Button asChild size="sm" className="mt-2">
        <Link to="/connect">Connect eLearn</Link>
      </Button>
    </div>
  );
}
