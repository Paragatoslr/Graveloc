import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "graveloc-theme";
const ThemeContext = createContext(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyTheme(mode) {
  const resolved = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(loadTheme);
  const resolved = useMemo(() => (theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme), [theme]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, resolved]);

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme: setThemeState,
      toggleTheme() {
        setThemeState((current) => {
          const active = current === "system" ? (systemPrefersDark() ? "dark" : "light") : current;
          return active === "dark" ? "light" : "dark";
        });
      },
    }),
    [theme, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

/** Apply saved theme before React paints to reduce flash. */
export function initTheme() {
  applyTheme(loadTheme());
}
