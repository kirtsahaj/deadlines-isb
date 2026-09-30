import { useState } from "react";
import { AlertTriangle, ChevronDown, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, relativeTime } from "@/lib/format";

export type DeadlineRow = {
  id: string;
  title: string;
  kind: string;
  deadline_type: string;
  deadline_status: string;
  submission_status: string;
  due_at: string | null;
  conflict: boolean;
  moodle_course_id: number;
  source_primary: string;
  source_evidence: unknown;
  text_evidence: string | null;
  text_precision: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  mod_assign_get_assignments: "Assignment due date",
  mod_assign_get_submission_status: "Submission status",
  mod_quiz_get_quizzes_by_courses: "Quiz close time",
  mod_forum_get_forums_by_courses: "Forum due date",
  core_calendar_get_calendar_events: "Course calendar",
  "core_course_get_contents.description": "Course text",
};

const KIND_LABELS: Record<string, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  forum: "Forum",
  calendar: "Calendar",
  text: "Mentioned in text",
};

export function DeadlineCard({
  item,
  courseName,
  timezone,
}: {
  item: DeadlineRow;
  courseName: string;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const isText = item.kind === "text";
  const tbd = !item.due_at;
  const overdue =
    !!item.due_at &&
    new Date(item.due_at).getTime() < Date.now() &&
    item.submission_status !== "submitted";

  return (
    <article className="surface-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {courseName}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">{item.title}</h3>
        </div>
        <Badge variant="secondary">{KIND_LABELS[item.kind] ?? item.kind}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          {tbd ? "Date to be confirmed" : formatDateTime(item.due_at, timezone)}
        </span>
        {!tbd && <span className="text-muted-foreground">{relativeTime(item.due_at)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.deadline_type !== "due" && (
          <Badge variant="outline">
            {item.deadline_type === "cutoff" ? "Hard cut-off" : item.deadline_type}
          </Badge>
        )}
        {item.submission_status === "submitted" && (
          <Badge className="bg-success text-success-foreground">Submitted</Badge>
        )}
        {overdue && <Badge variant="destructive">Past due</Badge>}
        {isText && (
          <Badge variant="outline">
            Mentioned in course text
            {item.text_precision === "assumed_end_of_day" ? " · time assumed" : ""}
          </Badge>
        )}
        {item.conflict && (
          <Badge className="bg-warning text-warning-foreground">
            <AlertTriangle className="mr-1 size-3" aria-hidden />
            Sources disagree
          </Badge>
        )}
      </div>

      {(isText || item.conflict) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Not an official due date. Confirm this one in eLearn before you rely on it.
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2 h-8 px-2 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        Where this came from
      </Button>

      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Source:</span>{" "}
            {SOURCE_LABELS[item.source_primary] ?? item.source_primary}
          </p>
          {item.text_evidence && (
            <p>
              <span className="font-medium text-foreground">Quoted text:</span> “
              {item.text_evidence}”
            </p>
          )}
          {item.deadline_status === "TBD" && <p>eLearn has not published a date for this item.</p>}
        </div>
      )}
    </article>
  );
}
