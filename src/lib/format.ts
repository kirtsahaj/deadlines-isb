export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function formatDateTime(iso: string | null, timezone = DEFAULT_TIMEZONE): string {
  if (!iso) return "TBD";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
    ["week", 604_800_000],
    ["month", 2_592_000_000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = ["minute", 60_000];
  for (const unit of units) if (abs >= unit[1]) chosen = unit;
  return formatter.format(Math.round(diffMs / chosen[1]), chosen[0]);
}

export function lastSyncedLabel(iso: string | null | undefined): string {
  if (!iso) return "Not synced yet";
  return `Last synced ${relativeTime(iso)}`;
}
