import { useI18n } from "../app/providers/I18nProvider";

export default function LanguageToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button
      onClick={toggle}
      aria-label="Language"
      style={{
        height: 38, minWidth: 38, padding: "0 12px", borderRadius: 9,
        border: "1px solid var(--line)", background: "var(--surface)",
        color: "var(--ink)", cursor: "pointer", fontWeight: 600, fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {lang === "fr" ? "FR" : "EN"}
    </button>
  );
}
