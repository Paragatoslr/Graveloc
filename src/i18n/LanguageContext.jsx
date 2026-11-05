import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fil } from "./fil";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("graveloc-lang") || "en");

  useEffect(() => {
    localStorage.setItem("graveloc-lang", lang);
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);

  const value = useMemo(() => {
    const t = (english, vars) => {
      let text = lang === "fil" ? fil[english] ?? english : english;
      if (vars) {
        Object.entries(vars).forEach(([key, replacement]) => {
          text = text.replaceAll(`{${key}}`, String(replacement));
        });
      }
      return text;
    };
    return { lang, setLang, t };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}
