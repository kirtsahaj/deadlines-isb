import { AlertTriangle, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  courseCode,
  timezone,
}: {
  item: DeadlineRow;
  courseName: string;
  courseCode: string;
  timezone: string;
}) {
  const isText = item.kind === "text";
  const tbd = !item.due_at;
  const overdue =
    !!item.due_at &&
    new Date(item.due_at).getTime() < Date.now() &&
    item.submission_status !== "submitted";

  return (
    <article className="deadline-card relative p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className="course-code">{courseCode}</span>
            <span className="truncate text-xs text-muted-foreground">{courseName}</span>
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">{item.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{KIND_LABELS[item.kind] ?? item.kind}</Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Information about ${item.title}`}>
                <Info className="size-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-lg">
              <DialogHeader>
                <DialogTitle>Deadline information</DialogTitle>
                <DialogDescription>{item.title}</DialogDescription>
              </DialogHeader>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium">Source</dt>
                  <dd className="text-muted-foreground">{SOURCE_LABELS[item.source_primary] ?? "eLearn course data"}</dd>
                </div>
                <div>
                  <dt className="font-medium">How this date was found</dt>
                  <dd className="text-muted-foreground">{isText || item.deadline_status === "dated_from_text" ? "Mentioned in course text" : "Published as a structured eLearn deadline"}</dd>
                </div>
                {item.text_evidence && (
                  <div>
                    <dt className="font-medium">Evidence</dt>
                    <dd className="text-muted-foreground">“{item.text_evidence}”</dd>
                  </div>
                )}
                {item.conflict && <div><dt className="font-medium">Sources disagree</dt><dd className="text-muted-foreground">The activity and calendar show different times. Check the activity in eLearn before relying on this date.</dd></div>}
                {(isText || item.deadline_status === "dated_from_text") && <div className="rounded-md bg-warning/15 p-3 text-warning-foreground">This is not a confirmed eLearn due date. Check the activity before relying on it.</div>}
                {item.deadline_status === "TBD" && <div className="text-muted-foreground">eLearn has not published a date for this item.</div>}
              </dl>
            </DialogContent>
          </Dialog>
        </div>
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

    </article>
  );
}
