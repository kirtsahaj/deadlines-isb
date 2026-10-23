export type AppTheme = "light" | "dark";
export type ThemePreference = "system" | "light" | "dark";

export function savedPreference(value: string | null): ThemePreference {
  return value === "dark" || value === "light" ? value : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): AppTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/** @deprecated kept for older callers */
export function savedTheme(value: string | null): AppTheme {
  return value === "dark" ? "dark" : "light";
}
