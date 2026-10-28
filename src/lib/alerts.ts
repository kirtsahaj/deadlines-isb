/** Browser-safe rules for the three notification bells (Assignments, Classes, Placements). */
export type AlertCategory = "deadlines" | "classes" | "jobs";

export const ALERT_COLUMNS: Record<AlertCategory, "deadline_reminders" | "class_reminders" | "job_reminders"> = {
  deadlines: "deadline_reminders",
  classes: "class_reminders",
  jobs: "job_reminders",
};

export const ALERT_LABELS: Record<AlertCategory, string> = {
  deadlines: "Assignment alerts",
  classes: "Class alerts",
  jobs: "Job alerts",
};

export type AlertSettings = Record<AlertCategory, boolean>;

/** Every category defaults to on; only an explicit false (a bell turned off) opts out. */
export function readAlertSettings(row: Record<string, unknown> | null | undefined): AlertSettings {
  return {
    deadlines: row?.["deadline_reminders"] !== false,
    classes: row?.["class_reminders"] !== false,
    jobs: row?.["job_reminders"] !== false,
  };
}

/** Prereads belong to Classes; every other merged item belongs to Assignments. */
export function categoryForItem(item: { kind: string }): AlertCategory {
  return item.kind === "preread" ? "classes" : "deadlines";
}
