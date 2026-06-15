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
        width: 240, flexShrink: 0, borderRight: "1px solid var(--line)",
        background: "var(--surface)", display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px" }}>
        <Logo size={30} />
        <span style={{ lineHeight: 1 }}>
          <span className="font-serif-brand" style={{ fontSize: 18, fontWeight: 500, color: "var(--ink)" }}>Synapse</span>
          <span style={{ display: "block", fontSize: 8.5, letterSpacing: 3, color: "var(--gold-deep)", fontWeight: 600, marginTop: 2 }}>DIGITAL</span>
        </span>
      </div>

      <nav style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {items.map((it) => {
          const Icon = Icons[it.icon] || Icons.Circle;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/app" || it.to === "/rh" || it.to === "/admin"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 12px", borderRadius: 9, fontSize: 14,
                color: isActive ? "var(--gold-deep)" : "var(--muted)",
                background: isActive ? "var(--gold-tint)" : "transparent",
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <Icon size={18} />
              {t(it.key)}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
