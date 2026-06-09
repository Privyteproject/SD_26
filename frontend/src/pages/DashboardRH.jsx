import { useLoader } from '../components/GlobalLoader';
import { useState, useEffect } from "react";
import {
  Sun, Moon, LogOut, Users, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Download, RefreshCw, Menu, LayoutDashboard,
  Activity, Filter, UserCheck, Settings, FileText, Calendar, Archive
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getColors } from "../theme";
import { Sidebar } from "../components/Sidebar";
import { useKpiRH } from "../auth/useKpi";
import { Skeleton, SkeletonGrid, SkeletonStyles } from "../components/Skeleton";
import RoleGuard from "../components/RoleGuard";
import toast, { Toaster } from "react-hot-toast";

export default function DashboardRH({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, refetch } = useKpiRH();
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
    { label: "Effectif total",        value: data.effectifTotal,    delta: `+${data.effectifDelta}`,         up: true,  icon: <Users size={20} />,       sub: "vs mois dernier",   badUp: false },
    { label: "Taux d'absentéisme",    value: `${data.tauxAbsenteisme}%`, delta: `${data.absenteismeDelta}%`, up: data.absenteismeDelta > 0, icon: <Clock size={20} />, sub: "vs mois dernier", badUp: true },
    { label: "Taux de turnover",      value: `${data.tauxTurnover}%`,    delta: `+${data.turnoverDelta}%`,   up: true,  icon: <TrendingUp size={20} />,  sub: "annualisé",         badUp: true },
    { label: "Alertes actives",       value: data.alertesActives,   delta: `+${data.alertesDelta}`,          up: true,  icon: <AlertTriangle size={20}/>,sub: "désengagement",      badUp: true },
  ] : [];

  const riskColor = (risk) => {
    if (risk === "Élevé")  return { bg: c.danger,  text: c.dangerText };
    if (risk === "Moyen")  return { bg: c.warn,    text: c.warnText };
    return                        { bg: c.success, text: c.successText };
  };

  const barMax = data ? Math.max(...data.absenteismeMensuel) + 1 : 6;

  const engagementColors = [c.successText, c.gold, c.warnText, c.dangerText];
  const r2 = 38, cx2 = 52, cy2 = 52, circ = 2 * Math.PI * r2;
  const filled = data ? (data.scoreEngagement / 100) * circ : 0;

  const handleRefresh = async () => {
    await refetch();
    toast.success("Données actualisées");
  };

  const role = user?.role;
  const sidebarRole = role === "admin" ? "admin" : "rh";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: c.bg, color: c.ink,
      fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", transition: "background .4s" }}>
      <Toaster position="top-right" />
      <SkeletonStyles c={c} />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      <Sidebar c={c} role={sidebarRole}
        userName={user?.name || "—"}
        userInitials={user?.initials || "?"}
        userSubtitle={role === "manager" ? "Manager" : "Responsable RH"}
        isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 58, background: c.surface, borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.ink, display: "flex" }}><Menu size={22} /></button>}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>Dashboard RH — {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</div>
              <div style={{ fontSize: 11, color: c.muted }}>Bonjour {user?.name?.split(" ")[0]} · Dernière MAJ : aujourd'hui</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={handleRefresh} style={{ display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1px solid ${c.line}`, borderRadius: 8,
              color: c.muted, padding: "7px 12px", cursor: "pointer", fontSize: 12.5 }}>
              <RefreshCw size={14} /> Actualiser
            </button>
            <button onClick={() => toast("Export en cours…", { icon: "📊" })}
              style={{ display: "flex", alignItems: "center", gap: 6, background: c.gold,
                color: c.onGold, border: "none", borderRadius: 8, padding: "7px 12px",
                cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
              <Download size={14} /> Exporter
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

          {/* KPIs */}
          {loading ? (
            <div style={{ marginBottom: 22 }}><SkeletonGrid c={c} count={4} cols={isMobile ? 2 : 4} /></div>
          ) : (
            <div style={{ display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
              gap: 14, marginBottom: 22 }}>
              {kpis.map((kpi, i) => (
                <div key={i} style={{ background: c.surface, border: `1px solid ${c.line}`,
                  borderRadius: 14, padding: "16px 18px", boxShadow: c.shadowCard }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: c.muted, fontWeight: 500 }}>{kpi.label}</div>
                    <div style={{ color: c.gold }}>{kpi.icon}</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: c.ink }}>{kpi.value}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 2,
                      color: kpi.badUp ? (kpi.up ? c.dangerText : c.successText) : (kpi.up ? c.successText : c.dangerText) }}>
                      {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {kpi.delta}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 22 }}>
            {/* Bar chart absentéisme */}
            {loading ? (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20 }}>
                <Skeleton height={14} width="50%" style={{ marginBottom: 16 }} />
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                  {[60,75,95,82,65,70].map((h, i) => (
                    <Skeleton key={i} width="100%" height={h} style={{ borderRadius: "4px 4px 0 0" }} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>Absentéisme mensuel (%)</h3>
                  <span style={{ fontSize: 11, color: c.muted, background: c.badge, padding: "3px 8px", borderRadius: 6 }}>2026</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
                  {(data?.absenteismeMensuel || []).map((v, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10, color: c.muted }}>{v}%</span>
                      <div style={{ width: "100%", height: `${(v / barMax) * 80}px`,
                        background: i === (data.absenteismeMensuel.length - 1)
                          ? `linear-gradient(to top, ${c.gold}, ${c.goldDeep})` : c.line,
                        borderRadius: "4px 4px 0 0", transition: "height .4s" }} />
                      <span style={{ fontSize: 10, color: c.muted }}>{data.absenteismeLabels[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Donut engagement */}
            {loading ? (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20 }}>
                <Skeleton height={14} width="50%" style={{ marginBottom: 16 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <Skeleton width={104} height={104} radius={52} />
                  <div style={{ flex: 1 }}>
                    {[1,2,3,4].map(i => <Skeleton key={i} height={10} style={{ marginBottom: 10 }} />)}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink, marginBottom: 16 }}>Score d'engagement global</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <svg width={104} height={104} viewBox="0 0 104 104">
                    <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={c.line} strokeWidth={10} />
                    <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={c.gold} strokeWidth={10}
                      strokeDasharray={`${filled} ${circ - filled}`}
                      strokeDashoffset={circ * 0.25} strokeLinecap="round" />
                    <text x={cx2} y={cy2 - 6} textAnchor="middle" fill={c.ink} fontSize={20} fontWeight={700}>{data?.scoreEngagement}</text>
                    <text x={cx2} y={cy2 + 12} textAnchor="middle" fill={c.muted} fontSize={11}>/ 100</text>
                  </svg>
                  <div style={{ flex: 1 }}>
                    {(data?.repartitionEngagement || []).map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: engagementColors[i], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: c.muted, flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: c.ink }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alertes désengagement */}
          {loading ? (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20 }}>
              <Skeleton height={14} width="40%" style={{ marginBottom: 16 }} />
              {[1,2,3,4].map(i => <Skeleton key={i} height={60} style={{ marginBottom: 10, borderRadius: 10 }} />)}
            </div>
          ) : (
            <div style={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 16, padding: 20, boxShadow: c.shadowCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: c.ink, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={16} color={c.dangerText} /> Alertes désengagement
                </h3>
                <button onClick={() => toast("Filtre appliqué")}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
                    border: `1px solid ${c.line}`, borderRadius: 7, color: c.muted,
                    padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>
                  <Filter size={13} /> Filtrer
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(data?.alertesDesengagement || []).map((a, i) => {
                  const rc = riskColor(a.risk);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14,
                      background: c.surfaceAlt, border: `1px solid ${c.line}`,
                      borderRadius: 10, padding: "12px 16px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.badge,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.goldDeep }}>
                          {a.name.split(" ").map(n => n[0]).join("")}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: c.ink }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: c.muted }}>{a.dept} · {a.reason}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <div style={{ width: 70, height: 5, background: c.line, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${a.score}%`,
                            background: a.risk === "Élevé" ? c.dangerText : a.risk === "Moyen" ? c.warnText : c.successText,
                            borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.ink, width: 28 }}>{a.score}</span>
                        <span style={{ background: rc.bg, color: rc.text, borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 600 }}>{a.risk}</span>
                        <RoleGuard roles={["rh","admin"]}>
                          <button onClick={() => toast.success(`Plan d'action ouvert pour ${a.name}`)}
                            style={{ background: c.gold, color: c.onGold, border: "none", borderRadius: 7,
                              padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            Agir
                          </button>
                        </RoleGuard>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
