export type AppTheme = "light" | "dark";

export function savedTheme(value: string | null): AppTheme {
  return value === "dark" ? "dark" : "light";
}