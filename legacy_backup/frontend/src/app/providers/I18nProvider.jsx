import { createContext, useContext, useEffect, useState } from "react";
import { DICT } from "../../i18n/dict";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("sd-lang") || "fr"; } catch { return "fr"; }
  });

  useEffect(() => {
    try { localStorage.setItem("sd-lang", lang); } catch { /* ignore */ }
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const t = (key) => (DICT[lang] && DICT[lang][key]) || key;
  const toggle = () => setLang((l) => (l === "fr" ? "en" : "fr"));

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
