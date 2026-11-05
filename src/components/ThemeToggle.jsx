import { useI18n } from "../i18n/LanguageContext";
import { useTheme } from "../theme/ThemeContext";

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolved, toggleTheme } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? t("Switch to light mode") : t("Switch to dark mode")}
      title={dark ? t("Light mode") : t("Dark mode")}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
