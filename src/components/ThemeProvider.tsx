import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveTheme, savedPreference, type AppTheme, type ThemePreference } from "@/lib/theme";

type Ctx = { theme: AppTheme; preference: ThemePreference; setPreference: (p: ThemePreference) => void };
const ThemeContext = createContext<Ctx>({ theme: "light", preference: "system", setPreference: () => {} });
const STORAGE_KEY = "deadline-tracker-theme-v2";
const LEGACY_KEY = "deadline-tracker-theme";
/** Browser chrome (status bar / address bar) colours matching the page background. */
const CHROME: Record<AppTheme, string> = { light: "#fcfbfe", dark: "#09080e" }; // = top of --page-gradient

function applyTheme(next: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
  // Safari ignores in-place theme-color updates, so recreate the node.
  document.querySelector('meta[name="theme-color"]')?.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = CHROME[next];
  document.head.appendChild(meta);
}

function isIosStandalone() {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return standalone && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    let pref: ThemePreference = "system";
    try {
      // One-time reset: drop choices saved before the Display setting existed.
      window.localStorage.removeItem(LEGACY_KEY);
      pref = savedPreference(window.localStorage.getItem(STORAGE_KEY));
    } catch { /* default */ }
    setPref(pref);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const next = resolveTheme(preference, mq.matches);
      setTheme(next);
      applyTheme(next);
    };
    update();
    if (preference !== "system") return;
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [preference]);

  const setPreference = (p: ThemePreference) => {
    const before = theme;
    setPref(p);
    try { window.localStorage.setItem(STORAGE_KEY, p); } catch { /* this visit only */ }
    const after = resolveTheme(p, window.matchMedia("(prefers-color-scheme: dark)").matches);
    // iOS Home Screen apps only read the status-bar colour on load.
    if (after !== before && isIosStandalone()) window.setTimeout(() => window.location.reload(), 150);
  };

  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
