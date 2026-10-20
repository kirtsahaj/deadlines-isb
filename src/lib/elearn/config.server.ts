export function elearnBaseUrl(): string {
  return process.env["ELEARN_BASE_URL"] ?? "https://elearn.isb.edu";
}

export function allowedEmailDomains(): string[] {
  return (process.env["ALLOWED_EMAIL_DOMAINS"] ?? "isb.edu")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function emailAllowed(email: string | null | undefined): boolean {
  const domains = allowedEmailDomains();
  const domain = (email ?? "").toLowerCase().trim().split("@").at(-1) ?? "";
  return domains.length > 0 && !!email && email.includes("@") && domains.includes(domain);
}

export function syncIntervalMinutes(): number {
  return Math.max(15, Number(process.env["SYNC_INTERVAL_MINUTES"] ?? 30));
}

export function manualCooldownSeconds(): number {
  return Math.max(60, Number(process.env["MANUAL_SYNC_COOLDOWN_SECONDS"] ?? 300));
}

export function syncBatchSize(): number {
  return Math.min(100, Math.max(1, Number(process.env["SYNC_BATCH_SIZE"] ?? 20)));
}

export function syncConcurrency(): number {
  return Math.min(6, Math.max(1, Number(process.env["SYNC_CONCURRENCY"] ?? 6) || 6));
}

