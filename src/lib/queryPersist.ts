import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

/**
 * Keeps the student's last-loaded screens on this device so the app opens instantly
 * (iPhone home-screen apps are often restarted from scratch). Restored data is shown
 * straight away and refreshed in the background. Per-user, discarded after a day,
 * and cleared on sign-out. Only these screens' data is kept (never admin data or links).
 */
const STORAGE_KEY = "query-cache-v2";
const OLD_KEYS = ["query-cache-v1"];
const MAX_AGE_MS = 24 * 3600_000;
const KEEP = new Set([
  "term5",
  "deadlines",
  "courses",
  "user-settings",
  "profile",
  "deadline-done",
  "connection-state",
  "account-access",
  "jobs",
  "alert-settings",
]);

/** Only plain JSON (objects, arrays, strings, numbers, booleans, null) survives saving; skip anything else. */
export function isPlainJson(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => isPlainJson(v, depth + 1));
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(value as Record<string, unknown>).every((v) => v === undefined || isPlainJson(v, depth + 1));
  }
  return false;
}

type Saved = { userId: string; savedAt: number; state: ReturnType<typeof dehydrate> };

/** Restore this user's saved data into the cache. Call once, as soon as the signed-in user is known. */
export function restoreQueryCache(queryClient: QueryClient, userId: string): boolean {
  try {
    for (const key of OLD_KEYS) window.localStorage.removeItem(key);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as Saved;
    if (saved.userId !== userId || Date.now() - saved.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    hydrate(queryClient, saved.state);
    return true;
  } catch {
    return false;
  }
}

/** Save the cache whenever a kept query updates (throttled). Returns an unsubscribe function. */
export function persistQueryCache(queryClient: QueryClient, userId: string): () => void {
  let timer: number | undefined;
  const save = () => {
    timer = undefined;
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" && KEEP.has(String(q.queryKey[0])) && isPlainJson(q.state.data),
      });
      const saved: Saved = { userId, savedAt: Date.now(), state };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage full or blocked: the app still works, it just won't open instantly */
    }
  };
  const schedule = () => {
    if (timer === undefined) timer = window.setTimeout(save, 1000);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && KEEP.has(String(event.query.queryKey[0]))) schedule();
  });
  const onHide = () => {
    if (document.visibilityState === "hidden") save();
  };
  document.addEventListener("visibilitychange", onHide);
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}

export function clearPersistedQueryCache() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing saved */
  }
}
