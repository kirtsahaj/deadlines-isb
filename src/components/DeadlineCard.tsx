import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { elearnDestination } from "@/lib/elearnDestination";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { SourceRef, UnifiedDeadline } from "@/lib/term5/model";
import { CONFIDENCE_META, ConfidenceMark, ConnectCta } from "@/components/Confidence";

const KIND_LABELS: Record<string, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  forum: "Forum",
  calendar: "Calendar",
  text: "Mentioned in text",
  choice: "Choice",
  outline: "From outline",
  preread: "Preread",
};

const OUTLINE_KIND: Record<string, string> = {
  elearn_retrieved_outline: "Course outline from eLearn",
  sharepoint_outline: "Course outline (SharePoint)",
  atrium_fallback_outline: "Earlier Atrium outline (fallback)",
};

function formatDateOnly(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date}T12:00:00+05:30`),
  );
}

function whenLabel(item: { dueAt: string | null; dateOnly: string | null }, timezone: string) {
  if (item.dueAt) return formatDateTime(item.dueAt, timezone);
  if (item.dateOnly) return `${formatDateOnly(item.dateOnly)} · time not given`;
  return "Date not announced yet";
}

function SourceLine({ source, outlineKind, timezone }: { source: SourceRef; outlineKind: string | null; timezone: string }) {
  const name =
    source.kind === "own_elearn"
      ? "Your eLearn"
      : source.kind === "shared_elearn"
        ? "A classmate's eLearn (course details only)"
        : (outlineKind && OUTLINE_KIND[outlineKind]) || "Course outline";
  return (
    <li className="rounded-lg bg-muted/60 p-3">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{whenLabel({ dueAt: source.dueAt, dateOnly: source.date }, timezone)}</p>
      {source.observedAt && (
        <p className="text-xs text-muted-foreground">Last seen {relativeTime(source.observedAt)}</p>
      )}
      {source.note && <p className="text-xs text-muted-foreground">{source.note}</p>}
    </li>
  );
}

export function DeadlineCard({
  item,
  timezone,
  connected,
  outlineKind,
}: {
  item: UnifiedDeadline;
  timezone: string;
  connected: boolean;
  outlineKind: string | null;
}) {
  const at = item.dueAt ?? (item.dateOnly ? `${item.dateOnly}T23:59:59+05:30` : null);
  const overdue = !!at && new Date(at).getTime() < Date.now() && item.submissionStatus !== "submitted";
  const meta = CONFIDENCE_META[item.confidence];
  const isText = item.kind === "text";
  const destination = elearnDestination(item);

  return (
    <article className="deadline-card relative p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="course-code">{item.courseCode}</span>
            <span className="truncate text-xs text-muted-foreground">{item.courseName}</span>
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">{item.title}</h3>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon"
              type="button"
              className="tap-target -mr-1 grid size-9 place-items-center rounded-full hover:bg-muted"
              aria-label={`${meta.label}. Source details for ${item.title}`}
            >
              <ConfidenceMark value={item.confidence} />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ConfidenceMark value={item.confidence} /> {meta.label}
              </DialogTitle>
              <DialogDescription>{item.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{meta.explain} The dot shows how confident the tracker is, not a guarantee.</p>
              <ul className="space-y-2">
                {item.sources.map((s, i) => (
                  <SourceLine key={i} source={s} outlineKind={outlineKind} timezone={timezone} />
                ))}
              </ul>
              {item.conflict && (
                <p className="rounded-lg bg-warning/15 p-3">
                  These sources show different dates. Check eLearn or with your course team before relying on one.
                </p>
              )}
              {item.otherSection && (
                <p className="rounded-lg bg-muted p-3">Seen for another section — it may not apply to yours.</p>
              )}
              {item.own?.text_evidence && <p className="text-muted-foreground">“{item.own.text_evidence}”</p>}
              {item.outline && item.outline.deadline_rule !== "explicit" && (
                <p className="text-muted-foreground">
                  {item.dateOnly || item.dueAt
                    ? "The outline links this to a class; the exact cut-off isn't stated."
                    : "The outline doesn't give a date yet."}
                </p>
              )}
              <ConnectCta connected={connected} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          {item.kind === "preread" ? "Class starts " : ""}{whenLabel(item, timezone)}
          {item.provisional && item.dueAt ? " · estimated" : ""}
        </span>
        {item.dueAt && <span className="text-muted-foreground">{relativeTime(item.dueAt)}</span>}
      </div>

      {item.preparation && <ul className="mt-3 space-y-2 text-sm">
        {item.preparation.map(p => <li key={p.id}>{p.title} <span className="text-xs text-muted-foreground">· {p.requirement === "assigned" ? "Required" : p.requirement}</span></li>)}
      </ul>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary">{KIND_LABELS[item.kind] ?? item.kind}</Badge>
        {item.deadlineType === "cutoff" && <Badge variant="outline">Hard cut-off</Badge>}
        {item.submissionStatus === "submitted" && (
          <Badge className="bg-success text-success-foreground">Submitted</Badge>
        )}
        {overdue && item.kind !== "preread" && <Badge variant="destructive">Past due</Badge>}
        {isText && <Badge variant="outline">Mentioned in course text</Badge>}
        {item.conflict && (
          <Badge className="bg-warning text-warning-foreground">
            <AlertTriangle className="mr-1 size-3" aria-hidden />
            Dates differ
          </Badge>
        )}
      </div>
      {destination && <Button asChild variant="outline" size="sm" className="mt-3">
        <a href={destination.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />{destination.activity ? "Open assignment / activity" : "Open course in eLearn"}</a>
      </Button>}
    </article>
  );
}
