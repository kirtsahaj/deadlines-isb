export function firstPreferredName(
  metadata: Record<string, unknown> | null | undefined,
  profileName: string | null | undefined,
): string | null {
  const candidates = [
    metadata?.["given_name"],
    metadata?.["preferred_username"],
    metadata?.["full_name"],
    metadata?.["name"],
    profileName,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const clean = candidate.trim();
    if (!clean || clean.includes("@")) continue;
    return clean.split(/\s+/)[0] ?? null;
  }
  return null;
}