import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, ChevronDown } from "lucide-react";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { ROLE_LABELS } from "../lib/constants";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { currentUser, role, logout } = useSession();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); navigate("/login"); };
  const initial = currentUser ? currentUser.name.charAt(0) : "?";

  return (
    <header style={{ height: 64, flexShrink: 0, borderBottom: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", gap: 14, padding: "0 22px", position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 360, height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
        <Search size={16} />
        <input placeholder={t("header.search")} style={{ border: "none", outline: "none", background: "transparent", color: "var(--ink)", width: "100%", fontSize: 13.5, fontFamily: "inherit" }} />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <LanguageToggle />
        <ThemeToggle />
        <button aria-label="Notifications" style={{ width: 38, height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={18} />
        </button>

        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 8px 0 6px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{initial}</span>
            <span style={{ textAlign: "left", lineHeight: 1.15 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser ? currentUser.name : ""}</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>{role ? ROLE_LABELS[role][lang] : ""}</span>
            </span>
            <ChevronDown size={15} color="var(--muted)" />
          </button>

          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
              <div style={{ position: "absolute", right: 0, top: 46, minWidth: 200, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow)", zIndex: 31, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{currentUser ? currentUser.name : ""}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{currentUser ? currentUser.email : ""}</div>
                </div>
                <button onClick={doLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, color: "var(--danger)", fontWeight: 600 }}>
                  <LogOut size={16} /> {t("header.logout")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
