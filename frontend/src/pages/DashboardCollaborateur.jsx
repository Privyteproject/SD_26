import { useLoader } from '../components/GlobalLoader';
import { useState, useEffect } from "react";
import {
  Sun, Moon, Bell, LogOut, User, MessageSquare, FileText,
  Calendar, ChevronRight, TrendingUp, Clock, CheckCircle,
  AlertCircle, LayoutDashboard, Settings, X, Menu
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getColors } from "../theme";
import { Mark } from "../components/Mark";
import { Sidebar } from "../components/Sidebar";
import { useKpiCollab } from "../auth/useKpi";
import { Skeleton, SkeletonGrid, SkeletonStyles } from "../components/Skeleton";
import RoleGuard from "../components/RoleGuard";
import toast, { Toaster } from "react-hot-toast";

export default function DashboardCollaborateur({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading } = useKpiCollab();
  const { markDemoMode } = useLoader();

  const c = getColors(dark_);

  useEffect(() => { if (data) markDemoMode(true); }, [data, markDemoMode]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw < 768;

  const kpis = data ? [
    { label: "Jours de congé restants",  value: data.congesRestants,  unit: "jours", icon: <Calendar size={20} />,     color: c.gold },
    { label: "Jours d'absence ce mois",  value: data.absencesMois,    unit: "jours", icon: <Clock size={20} />,        color: c.goldDeep },
    { label: "Formations complétées",    value: data.formationsOk,    unit: `/${data.formationsTotal}`, icon: <CheckCircle size={20} />, color: c.successText },
    { label: "Score engagement",         value: data.scoreEngagement, unit: "%",     icon: <TrendingUp size={20} />,   color: c.successText },
  ] : [];

  const quickActions = [
    { icon: <FileText size={22} />,     label: "Demander une attestation", path: "/documents",  color: c.gold },
    { icon: <Calendar size={22} />,     label: "Poser des congés",         path: "/documents",  color: c.goldDeep },
    { icon: <MessageSquare size={22} />,label: "Poser une question RH",    path: "/assistant",  color: c.gold },
    { icon: <FileText size={22} />,     label: "Suivre ma formation",      path: "/onboarding", color: c.goldDeep },
  ];

  const onboardingSteps = data?.onboardingSteps || [];
  const onboardingProgress = onboardingSteps.length
    ? Math.round((onboardingSteps.filter(s => s.done).length / onboardingSteps.length) * 100)
    : 0;

  const alertBg   = (type) => type === "warn" ? c.warn    : type === "success" ? c.success : c.badge;
  const alertText = (type) => type === "warn" ? c.warnText: type === "success" ? c.successText : c.badgeText;

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const firstName = user?.name?.split(" ")[0] || "vous";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: c.bg, color: c.ink,
      fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", transition: "background .4s" }}>
      <Toaster position="top-right" />
      <SkeletonStyles c={c} />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      <Sidebar c={c} role="collab"
        userName={user?.name || "—"}
        userInitials={user?.initials || "?"}
        userSubtitle="Collaborateur"
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 58, background: c.surface, borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.ink, display: "flex" }}>
                <Menu size={22} />
              </button>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: c.ink }}>Bonjour, {firstName} 👋</div>
              <div style={{ fontSize: 11, color: c.muted, textTransform: "capitalize" }}>{today}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setNotifOpen(!notifOpen)}
                style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.line}`,
                  background: c.surface, color: c.ink, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={17} />
              </button>
              {data?.notifications?.length > 0 && (
                <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8,
                  borderRadius: "50%", background: c.gold, border: `2px solid ${c.surface}` }} />
              )}
              {notifOpen && (
                <div style={{ position: "absolute", top: 44, right: 0, width: 300,
                  background: c.surface, border: `1px solid ${c.line}`,
                  borderRadius: 12, boxShadow: c.shadow, zIndex: 100, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${c.line}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span>
                    <button onClick={() => setNotifOpen(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: c.muted }}><X size={14} /></button>
                  </div>
                  {(data?.notifications || []).map((n, i) => (
                    <div key={i} style={{ padding: "11px 16px",
                      borderBottom: i < (data.notifications.length - 1) ? `1px solid ${c.line}` : "none",
                      display: "flex", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                        background: n.type === "success" ? c.successText : n.type === "warn" ? c.gold : c.goldDeep }} />
                      <div>
                        <div style={{ fontSize: 12.5, color: c.ink }}>{n.text}</div>
                        <div style={{ fontSize: 11, color: c.muted, marginTop: 3 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setDark(!dark_)}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.line}`,
                background: c.surface, color: c.ink, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark_ ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: isMobile ? 16 : 24, overflowY: "auto" }}>

          {/* KPIs */}
          {loading ? (
            <SkeletonGrid c={c} count={4} cols={isMobile ? 2 : 4} />
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
              gap: 14, marginBottom: 22 }}>
              {kpis.map((kpi, i) => (
                <div key={i} style={{ background: c.surface, border: `1px solid ${c.line}`,
                  borderRadius: 14, padding: "16px 18px", boxShadow: c.shadowCard }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: c.muted, fontWeight: 500, lineHeight: 1.3 }}>{kpi.label}</div>
                    <div style={{ color: kpi.color }}>{kpi.icon}</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: c.ink }}>{kpi.value}</span>
                    <span style={{ fontSize: 13, color: c.muted }}>{kpi.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 22 }}>
            {/* Actions rapides */}
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: c.ink }}>Actions rapides</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {quickActions.map((a, i) => (
                  <button key={i} onClick={() => navigate(a.path)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: c.surfaceAlt, border: `1px solid ${c.line}`,
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                    color: c.ink, fontSize: 13.5, fontWeight: 500, transition: "all .2s", textAlign: "left",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.line; }}>
                    <span style={{ color: a.color }}>{a.icon}</span>
                    <span style={{ flex: 1 }}>{a.label}</span>
                    <ChevronRight size={16} color={c.muted} />
                  </button>
                ))}
              </div>
            </div>

            {/* Onboarding */}
            {loading ? (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
                <Skeleton height={14} width="50%" style={{ marginBottom: 16 }} />
                {[1,2,3,4,5].map(i => <Skeleton key={i} height={10} style={{ marginBottom: 12 }} />)}
              </div>
            ) : (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>Mon onboarding</h3>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.gold }}>{onboardingProgress}%</span>
                </div>
                <div style={{ height: 6, background: c.line, borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${onboardingProgress}%`, background: c.gold, borderRadius: 3, transition: "width .6s" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {onboardingSteps.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: step.done ? c.gold : "transparent",
                        border: `2px solid ${step.done ? c.gold : c.line}`,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {step.done && <CheckCircle size={12} color={c.onGold} strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: 13, color: step.done ? c.ink : c.muted, fontWeight: step.done ? 500 : 400 }}>{step.label}</span>
                      {!step.done && <span style={{ marginLeft: "auto", fontSize: 11, color: c.gold, fontWeight: 600 }}>À faire</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alertes RH */}
          {loading ? (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20 }}>
              <Skeleton height={14} width="40%" style={{ marginBottom: 16 }} />
              {[1,2,3].map(i => <Skeleton key={i} height={44} style={{ marginBottom: 10, borderRadius: 10 }} />)}
            </div>
          ) : (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: c.ink }}>Informations & Alertes RH</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(data?.alertes || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                    background: alertBg(item.type), borderRadius: 10, padding: "12px 14px" }}>
                    {item.type === "warn"    ? <AlertCircle size={16} color={alertText(item.type)} />
                   : item.type === "success" ? <CheckCircle size={16} color={alertText(item.type)} />
                   : <AlertCircle size={16} color={alertText(item.type)} />}
                    <span style={{ fontSize: 13, color: c.ink, flex: 1 }}>{item.msg}</span>
                    <button onClick={() => toast.success(`Action : ${item.action}`)}
                      style={{ background: "transparent", border: `1px solid ${alertText(item.type)}`,
                        color: alertText(item.type), borderRadius: 6, padding: "4px 10px",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RoleGuard — visible seulement RH+ */}
          <RoleGuard roles={["rh","manager","admin"]}>
            <div style={{ marginTop: 16, background: c.warn, border: `1px solid ${c.warnText}30`,
              borderRadius: 12, padding: "12px 16px", fontSize: 13, color: c.warnText,
              display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={15} />
              Accès RH/Manager : vous voyez ce bloc car votre rôle est élevé.
            </div>
          </RoleGuard>

        </main>
      </div>
    </div>
  );
}
