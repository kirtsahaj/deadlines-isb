import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savedTheme, type AppTheme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: AppTheme; toggle: () => void }>({ theme: "light", toggle: () => {} });
const STORAGE_KEY = "deadline-tracker-theme";
/** Browser chrome (status bar / address bar) colours matching the page background. */
const CHROME: Record<AppTheme, string> = { light: "#fbf9ff", dark: "#131317" };

function applyTheme(next: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
  // Safari ignores in-place theme-color updates, so recreate the node — this is
  // what makes the iPhone status bar repaint when night mode is toggled.
  document.querySelector('meta[name="theme-color"]')?.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = CHROME[next];
  document.head.appendChild(meta);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>("light");
  useEffect(() => {
    try {
      const next = savedTheme(window.localStorage.getItem(STORAGE_KEY));
      setTheme(next);
      applyTheme(next);
    } catch { /* Storage may be unavailable; day mode remains the default. */ }
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Theme still works for this visit. */ }
  };
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  const label = theme === "light" ? "Switch to night mode" : "Switch to day mode";
  return <Button variant="ghost" size="icon" className="tap-target shrink-0" onClick={toggle} aria-label={label} title={label}>
    {theme === "light" ? <Moon aria-hidden /> : <Sun aria-hidden />}
  </Button>;
}