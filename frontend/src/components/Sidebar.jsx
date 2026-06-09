import { useAuth } from '../auth/AuthContext';
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, FileText, Calendar,
  Archive, Settings, LogOut, Users, Shield, Activity,
  Database, Bell, User
} from "lucide-react";
import { Mark } from "./Mark";

const NAV_COLLAB = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard" },
  { icon: MessageSquare, label: "Assistant IA", path: "/assistant" },
  { icon: FileText, label: "Mes documents", path: "/documents" },
  { icon: Calendar, label: "Onboarding", path: "/onboarding" },
  { icon: Archive, label: "Offboarding", path: "/offboarding" },
  { icon: User, label: "Mon profil", path: "/profil" },
  { icon: Settings, label: "Paramètres", path: "/profil" },
];

const NAV_RH = [
  { icon: LayoutDashboard, label: "Vue d'ensemble", path: "/rh/dashboard" },
  { icon: Users, label: "Effectifs", path: "/rh/dashboard" },
  { icon: Activity, label: "Engagement", path: "/rh/dashboard" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Calendar, label: "Onboarding", path: "/onboarding" },
  { icon: Archive, label: "Offboarding", path: "/offboarding" },
  { icon: Settings, label: "Paramètres", path: "/profil" },
];

const NAV_ADMIN = [
  { icon: Shield, label: "Supervision sécurité", path: "/admin" },
  { icon: Activity, label: "Logs d'activité", path: "/admin" },
  { icon: Users, label: "Gestion des rôles", path: "/admin" },
  { icon: Database, label: "Base de données", path: "/admin" },
  { icon: Bell, label: "Alertes", path: "/admin" },
  { icon: Settings, label: "Configuration", path: "/profil" },
];

export function Sidebar({ c, role = "collab", userName, userInitials, userSubtitle, isMobile, open, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const location = useLocation();

  const navItems = role === "admin" ? NAV_ADMIN : role === "rh" ? NAV_RH : NAV_COLLAB;
  const subtitle = role === "admin" ? "ADMIN · SÉCURITÉ" : role === "rh" ? "DIGITAL · RH" : "DIGITAL";
  const subtitleColor = role === "admin" ? c.criticalText : c.goldDeep;

  return (
    <aside style={{
      width: 240, background: c.surface, borderRight: `1px solid ${c.line}`,
      display: "flex", flexDirection: "column",
      position: isMobile ? "fixed" : "sticky",
      top: 0, left: 0, height: "100vh", zIndex: 50, flexShrink: 0,
      transform: isMobile ? (open ? "translateX(0)" : "translateX(-240px)") : "none",
      transition: "transform .3s cubic-bezier(.2,.7,.3,1)",
      boxShadow: isMobile && open ? c.shadow : "none",
    }}>
      <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${c.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Mark size={28} c={c} />
        <span style={{ lineHeight: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: c.ink }}>Synapse</span>
          <span style={{ display: "block", fontSize: 8, letterSpacing: 3, color: subtitleColor, fontWeight: 600, marginTop: 2 }}>{subtitle}</span>
        </span>
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: c.onGold, fontWeight: 700, fontSize: 14 }}>{userInitials}</span>
        </div>
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</div>
          <div style={{ fontSize: 11, color: c.muted }}>{userSubtitle}</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button key={i} onClick={() => { navigate(item.path); if (isMobile) onClose(); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 18px", background: active ? c.surfaceAlt : "transparent",
              border: "none", cursor: "pointer", color: active ? c.gold : c.muted,
              fontSize: 13.5, fontWeight: active ? 600 : 400,
              borderLeft: active ? `3px solid ${c.gold}` : "3px solid transparent",
              transition: "all .2s", textAlign: "left",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = c.ink; e.currentTarget.style.background = c.surfaceAlt; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = c.muted; e.currentTarget.style.background = "transparent"; } }}>
              <Icon size={18} /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button onClick={() => { logout(); navigate("/"); }} style={{
        margin: "10px 18px 20px", display: "flex", alignItems: "center", gap: 8,
        background: "transparent", border: `1px solid ${c.line}`,
        borderRadius: 8, color: c.muted, padding: "9px 12px", cursor: "pointer", fontSize: 13,
      }}>
        <LogOut size={16} /> Se déconnecter
      </button>
    </aside>
  );
}
