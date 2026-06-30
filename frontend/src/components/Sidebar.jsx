import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { navForRole } from "../lib/nav";
import Logo from "./Logo";

const CKEY = "sd-nav-collapsed";

function Ico({ name, size = 18, ...rest }) {
  const I = Icons[name] || Icons.Circle;
  return <I size={size} strokeWidth={1.9} {...rest} />;
}

export default function Sidebar() {
  const { role, status } = useSession();
  const { t } = useI18n();
  const sections = navForRole(role, status);
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(CKEY)) || {}; } catch { return {}; }
  });
  const toggle = (id) => setCollapsed((c) => {
    const n = { ...c, [id]: !c[id] };
    try { sessionStorage.setItem(CKEY, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });

  const itemLink = (it, featured = false) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.to === "/app" || it.to === "/rh" || it.to === "/admin"}
      className="ds-nav"
      style={({ isActive }) => (featured ? {
        display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12,
        fontSize: 14, fontWeight: 600,
        color: isActive ? "var(--gold-deep)" : "var(--ink)",
        background: isActive ? "var(--gold-tint)" : "var(--bg-alt)",
        border: `1px solid ${isActive ? "var(--gold-soft)" : "var(--line)"}`,
        boxShadow: isActive ? "var(--shadow-sm)" : "none",
      } : {
        display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", borderRadius: 10, fontSize: 13.5,
        color: isActive ? "var(--gold-deep)" : "var(--muted)",
        background: isActive ? "var(--gold-tint)" : "transparent",
        fontWeight: isActive ? 600 : 500,
        boxShadow: isActive ? "inset 3px 0 0 var(--gold)" : "none",
      })}
    >
      {featured ? (
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--grad-gold)", color: "var(--on-gold)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Ico name={it.icon} size={16} />
        </span>
      ) : <Ico name={it.icon} />}
      {t(it.key)}
    </NavLink>
  );

  return (
    <aside style={{
      width: 256, flexShrink: 0, borderRight: "1px solid var(--line)",
      background: "var(--surface)", display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "20px 18px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <Logo size={32} />
        <span style={{ lineHeight: 1 }}>
          <span className="font-serif-brand" style={{ fontSize: 19, fontWeight: 500, color: "var(--ink)" }}>Synapse</span>
          <span style={{ display: "block", fontSize: 9, letterSpacing: 3.5, color: "var(--gold-deep)", fontWeight: 700, marginTop: 3 }}>DIGITAL</span>
        </span>
      </div>

      <nav style={{ padding: "12px 12px 20px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
        {sections.map((sec) => {
          if (sec.featured) {
            return <div key={sec.id} style={{ marginBottom: 2 }}>{sec.items.map((it) => itemLink(it, true))}</div>;
          }
          const isCol = !!collapsed[sec.id];
          return (
            <div key={sec.id} style={{ marginTop: 8 }}>
              <button
                onClick={() => sec.collapsible && toggle(sec.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px",
                  border: "none", background: "transparent", cursor: sec.collapsible ? "pointer" : "default",
                  color: "var(--faint)", fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase",
                }}>
                <Ico name={sec.icon} size={14} />
                <span style={{ flex: 1, textAlign: "left" }}>{t(sec.label)}</span>
                {sec.collapsible && <Ico name={isCol ? "ChevronRight" : "ChevronDown"} size={14} />}
              </button>
              {!isCol && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                  {sec.items.map((it) => itemLink(it, false))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "14px 18px", borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--faint)" }}>
        Synapse Digital · IA RH
      </div>
    </aside>
  );
}
