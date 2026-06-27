import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { navForRole } from "../lib/nav";
import Logo from "./Logo";

export default function Sidebar() {
  const { role, status } = useSession();
  const { t } = useI18n();
  const items = navForRole(role, status);

  return (
    <aside
      style={{
        width: 252, flexShrink: 0, borderRight: "1px solid var(--line)",
        background: "var(--surface)", display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0,
      }}
    >
      {/* Marque */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "20px 18px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <Logo size={32} />
        <span style={{ lineHeight: 1 }}>
          <span className="font-serif-brand" style={{ fontSize: 19, fontWeight: 500, color: "var(--ink)" }}>Synapse</span>
          <span style={{ display: "block", fontSize: 9, letterSpacing: 3.5, color: "var(--gold-deep)", fontWeight: 700, marginTop: 3 }}>DIGITAL</span>
        </span>
      </div>

      <nav style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
        {items.map((it) => {
          const Icon = Icons[it.icon] || Icons.Circle;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/app" || it.to === "/rh" || it.to === "/admin"}
              className="ds-nav"
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 13px", borderRadius: 10, fontSize: 14,
                color: isActive ? "var(--gold-deep)" : "var(--muted)",
                background: isActive ? "var(--gold-tint)" : "transparent",
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? "inset 3px 0 0 var(--gold)" : "none",
              })}
            >
              <Icon size={18} strokeWidth={1.9} />
              {t(it.key)}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "14px 18px", borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--faint)" }}>
        Synapse Digital · IA RH
      </div>
    </aside>
  );
}
