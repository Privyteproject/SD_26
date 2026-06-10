import { useState, useEffect } from "react";
import {
  Sun, Moon, Shield, AlertTriangle, Activity,
  Filter, Download, RefreshCw, Menu, LogOut,
  Settings, Bell, Slash, Database, Wifi,
  AlertCircle, CheckCircle, Search, Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { getColors } from "../../../theme";
import { Sidebar } from "../../../components/Sidebar";
import { useKpiAdmin } from "../../../auth/useKpi";
import { Skeleton, SkeletonStyles } from "../../../components/Skeleton";
import toast, { Toaster } from "react-hot-toast";

export default function DashboardAdmin({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab,   setActiveTab]   = useState("alertes");
  const [searchVal,   setSearchVal]   = useState("");
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, refetch } = useKpiAdmin();
  const c = getColors(dark_);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw < 768;

  const secKpis = data ? [
    { label: "Tentatives refusées", value: data.tentativesRefusees, delta: "+12", color: c.dangerText,  icon: <Slash size={20} /> },
    { label: "Accès suspects",      value: data.accesSuspects,      delta: "+2",  color: c.warnText,    icon: <AlertTriangle size={20} /> },
    { label: "Alertes critiques",   value: data.alertesCritiques,   delta: "NEW", color: c.criticalText,icon: <AlertCircle size={20} /> },
    { label: "Sessions actives",    value: data.sessionsActives,     delta: "Live",color: c.successText, icon: <Wifi size={20} /> },
  ] : [];

  const levelColor = (level) => {
    if (level === "Critique") return { bg: c.critical, text: c.criticalText };
    if (level === "Élevé")    return { bg: c.danger,   text: c.dangerText };
    if (level === "Moyen")    return { bg: c.warn,     text: c.warnText };
    return                           { bg: c.success,  text: c.successText };
  };

  const statusColor = (s) => {
    if (s === "OK")     return c.successText;
    if (s === "REFUSÉ" || s === "BLOQUÉ") return c.dangerText;
    return c.warnText;
  };

  const roleColors = [c.criticalText, c.gold, c.warnText, c.successText];

  const filteredLogs = (data?.logs || []).filter(l =>
    !searchVal ||
    l.user.toLowerCase().includes(searchVal.toLowerCase()) ||
    l.action.toLowerCase().includes(searchVal.toLowerCase())
  );

  const tabs = [
    { key: "alertes",  label: "Alertes sécurité", badge: data?.alertesCritiques },
    { key: "logs",     label: "Journaux d'accès" },
    { key: "roles",    label: "Gestion des rôles" },
  ];

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: c.bg, color: c.ink,
      fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", transition: "background .4s" }}>
      <Toaster position="top-right" />
      <SkeletonStyles c={c} />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      <Sidebar c={c} role="admin"
        userName={user?.name || "Admin"}
        userInitials={user?.initials || "AD"}
        userSubtitle="Super Administrateur"
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 58, background: c.surface, borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.ink, display: "flex" }}><Menu size={22} /></button>}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.ink, display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={15} color={c.gold} /> Supervision Sécurité
              </div>
              <div style={{ fontSize: 11, color: c.muted }}>
                {data ? `${data.alertesCritiques} alertes critiques actives` : "Chargement…"} · Surveillance temps réel
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={async () => { await refetch(); toast.success("Données actualisées"); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
                border: `1px solid ${c.line}`, borderRadius: 8, color: c.muted,
                padding: "7px 12px", cursor: "pointer", fontSize: 12 }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={() => toast("Export audit en cours…", { icon: "🔒" })}
              style={{ display: "flex", alignItems: "center", gap: 6, background: c.gold,
                color: c.onGold, border: "none", borderRadius: 8, padding: "7px 12px",
                cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
              <Download size={14} /> Exporter audit
            </button>
            <button onClick={() => setDark(!dark_)}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.line}`,
                background: c.surface, color: c.ink, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark_ ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: isMobile ? 14 : 24, overflowY: "auto" }}>

          {/* KPIs Sécurité */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 14, padding: "16px 18px" }}>
                  <Skeleton height={10} width="60%" style={{ marginBottom: 12 }} />
                  <Skeleton height={28} width="40%" style={{ marginBottom: 8 }} />
                  <Skeleton height={8} width="50%" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              {secKpis.map((kpi, i) => (
                <div key={i} style={{ background: c.surface, border: `1px solid ${c.line}`,
                  borderRadius: 14, padding: "16px 18px", boxShadow: c.shadowCard,
                  borderTop: `3px solid ${kpi.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: c.muted, fontWeight: 500 }}>{kpi.label}</div>
                    <div style={{ color: kpi.color }}>{kpi.icon}</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: c.ink }}>{kpi.value}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: kpi.color,
                      background: `${kpi.color}18`, padding: "2px 7px", borderRadius: 5 }}>{kpi.delta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: c.surface,
            padding: 4, borderRadius: 10, border: `1px solid ${c.line}`, width: "fit-content", flexWrap: "wrap" }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                background: activeTab === tab.key ? c.gold : "transparent",
                color: activeTab === tab.key ? c.onGold : c.muted,
                transition: "all .2s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{ background: activeTab === tab.key ? c.onGold : c.critical,
                    color: activeTab === tab.key ? c.gold : c.criticalText,
                    borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Alertes */}
          {activeTab === "alertes" && (
            loading ? (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20 }}>
                {[1,2,3].map(i => <Skeleton key={i} height={90} style={{ marginBottom: 12, borderRadius: 10 }} />)}
              </div>
            ) : (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>Alertes de sécurité actives</h3>
                  <button onClick={() => toast("Filtres ouverts")}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
                      border: `1px solid ${c.line}`, borderRadius: 7, color: c.muted,
                      padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                    <Filter size={13} /> Filtrer
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(data?.alertes || []).map((a, i) => {
                    const lc = levelColor(a.level);
                    return (
                      <div key={i} style={{ background: c.surfaceAlt, border: `1px solid ${c.line}`,
                        borderLeft: `4px solid ${lc.text}`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ background: lc.bg, color: lc.text, borderRadius: 6,
                              padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>{a.level}</span>
                            <span style={{ fontSize: 12, color: c.muted, fontFamily: "monospace" }}>{a.id}</span>
                            {a.count > 1 && (
                              <span style={{ background: c.tag, color: c.goldDeep, borderRadius: 5,
                                padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>×{a.count} tentatives</span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: c.muted }}>{a.date} · {a.time}</span>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 13.5, color: c.ink, fontWeight: 500 }}>{a.action}</div>
                          <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, color: c.muted }}>👤 {a.user}</span>
                            <span style={{ fontSize: 12, color: c.muted }}>Rôle : {a.role}</span>
                            <span style={{ fontSize: 12, color: c.muted, fontFamily: "monospace" }}>IP : {a.ip}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button onClick={() => toast.success(`Investigation ouverte pour ${a.id}`)}
                            style={{ background: c.gold, color: c.onGold, border: "none", borderRadius: 7,
                              padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Investiguer</button>
                          <button onClick={() => toast(`Alerte ${a.id} ignorée`)}
                            style={{ background: "transparent", color: c.muted, border: `1px solid ${c.line}`,
                              borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>Ignorer</button>
                          <button onClick={() => toast.error(`Accès bloqué pour ${a.user}`)}
                            style={{ background: c.danger, color: c.dangerText, border: "none", borderRadius: 7,
                              padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Bloquer</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Tab Logs */}
          {activeTab === "logs" && (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>Journaux d'activité</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: c.surfaceAlt,
                  border: `1px solid ${c.line}`, borderRadius: 8, padding: "7px 12px",
                  flex: isMobile ? 1 : "unset", minWidth: 220 }}>
                  <Search size={14} color={c.muted} />
                  <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
                    placeholder="Rechercher…"
                    style={{ background: "transparent", border: "none", outline: "none",
                      fontSize: 13, color: c.ink, width: "100%" }} />
                </div>
              </div>
              {loading ? (
                [1,2,3,4,5].map(i => <Skeleton key={i} height={38} style={{ marginBottom: 4 }} />)
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${c.line}` }}>
                        {["Heure", "Utilisateur", "Action", "Module", "Statut"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px",
                            color: c.muted, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${c.line}`,
                          background: i % 2 === 0 ? "transparent" : c.surfaceAlt }}>
                          <td style={{ padding: "9px 12px", fontFamily: "monospace", color: c.muted, fontSize: 12 }}>{log.time}</td>
                          <td style={{ padding: "9px 12px", color: c.ink, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.user}</td>
                          <td style={{ padding: "9px 12px", color: c.ink }}>{log.action}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ background: c.tag, color: c.badgeText, borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{log.module}</span>
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ color: statusColor(log.status), fontWeight: 700, fontSize: 12 }}>{log.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Rôles */}
          {activeTab === "roles" && (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink, marginBottom: 16 }}>Gestion des rôles & permissions</h3>
              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} height={120} style={{ borderRadius: 12 }} />)}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 14 }}>
                  {(data?.roles || []).map((role, i) => (
                    <div key={i} style={{ background: c.surfaceAlt, border: `1px solid ${c.line}`,
                      borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${roleColors[i]}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>{role.name}</span>
                        <span style={{ background: `${roleColors[i]}20`, color: roleColors[i],
                          borderRadius: 20, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>{role.count}</span>
                      </div>
                      {role.perms.map((p, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.muted, marginBottom: 6 }}>
                          <CheckCircle size={13} color={roleColors[i]} />{p}
                        </div>
                      ))}
                      <button onClick={() => toast(`Gestion ${role.name} ouverte`)}
                        style={{ marginTop: 10, width: "100%", background: "transparent",
                          border: `1px solid ${c.line}`, borderRadius: 7, color: c.muted,
                          padding: "7px 0", cursor: "pointer", fontSize: 12.5 }}>
                        Gérer les permissions →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
