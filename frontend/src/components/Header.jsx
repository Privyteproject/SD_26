import { Search, Bell } from "lucide-react";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { ROLE_LABELS } from "../lib/constants";
import DemoSwitcher from "./DemoSwitcher";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { role } = useSession();
  const { t, lang } = useI18n();

  return (
    <header
      style={{
        height: 64, flexShrink: 0, borderBottom: "1px solid var(--line)",
        background: "var(--bg)", display: "flex", alignItems: "center",
        gap: 14, padding: "0 22px", position: "sticky", top: 0, zIndex: 20,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 360,
          height: 38, padding: "0 12px", borderRadius: 9,
          border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)",
        }}
      >
        <Search size={16} />
        <input
          placeholder={t("header.search")}
          style={{ border: "none", outline: "none", background: "transparent", color: "var(--ink)", width: "100%", fontSize: 13.5, fontFamily: "inherit" }}
        />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <DemoSwitcher />
        <LanguageToggle />
        <ThemeToggle />
        <button aria-label="Notifications" style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>
            {ROLE_LABELS[role][lang].charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
