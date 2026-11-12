import { Link } from "@tanstack/react-router";
import { FileText, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Confidence } from "@/lib/term5/model";

/** Where a date came from, in plain words (we talk about the source, not confidence). */
export const CONFIDENCE_META: Record<Confidence, { label: string; explain: string }> = {
  own: {
    label: "From your eLearn",
    explain: "Comes from your own eLearn.",
  },
  own_stale: {
    label: "From your eLearn – not refreshed recently",
    explain: "From your own eLearn, but it hasn't refreshed for a while. Check eLearn if it matters.",
  },
  shared: {
    label: "From your section's eLearn",
    explain: "Seen on eLearn by classmates in your course and section.",
  },
  shared_other: {
    label: "From classmates' eLearn – may differ for you",
    explain: "Seen on eLearn by classmates, but not recently or not in your section. Check eLearn if it matters.",
  },
  // Prereads only: deadlines never come from the outline.
  outline: {
    label: "From the course outline",
    explain: "Taken from the course outline.",
  },
  provisional: {
    label: "Estimated from the course outline",
    explain: "Estimated from the outline and class schedule.",
  },
};

/**
 * Where a deadline came from, as an icon in a thin circle (colour comes from the parent):
 * your eLearn = person, classmates' eLearn = two people, outline (prereads only) = document.
 */
export function SourceIcon({ value }: { value: Confidence }) {
  const Icon = value === "own" || value === "own_stale" ? UserRound : value === "shared" || value === "shared_other" ? UsersRound : FileText;
  return (
    <span aria-hidden className="grid size-[14px] place-items-center rounded-full border-[1.5px] border-current">
      {/* Inline size beats the Button's [&_svg]:size-4 so the icon fits inside the circle. */}
      <Icon style={{ width: 9, height: 9 }} strokeWidth={2.75} />
    </span>
  );
}

/** The source icon at text size; colour comes from className (grey, or red while eLearn isn't connected). */
export function ConfidenceMark({ value, className = "text-muted-foreground" }: { value: Confidence; className?: string }) {
  return (
    <span aria-hidden className={`inline-grid size-5 place-items-center ${className}`}>
      <SourceIcon value={value} />
    </span>
  );
}

export function ConnectCta({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="rounded-xl border border-urgent/40 bg-urgent/8 p-3 text-sm">
      <p className="font-semibold text-urgent">eLearn not connected</p>
      <p className="mt-0.5">Connect eLearn to see all your deadlines and get reminders for them.</p>
      <Button asChild size="sm" className="mt-2">
        <Link to="/connect">Connect eLearn</Link>
      </Button>
    </div>
  );
}
