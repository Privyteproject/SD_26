import { useState } from "react";
import { Play } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend, LineChart, Line, PieChart, Pie } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardRisques, getDashboardIndicateurs, getEmployees, getProjection } from "../../../lib/api";

const COLORS = { high: "var(--danger)", mid: "#9a6b12", low: "#2e8c57" };

export default function PredictiveAnalytics() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("turnover");

  const [sim, setSim] = useState({ turnover_pct: "", hiring_per_month: "5", raise_pct: "2", absenteisme_pct: "", mobilite_pct: "" });
  const [proj, setProj] = useState(null);
  const [busy, setBusy] = useState(false);
  const runSim = async () => {
    setBusy(true);
    try {
      const params = { months: 12, hiring_per_month: Number(sim.hiring_per_month) || 0, raise_pct: Number(sim.raise_pct) || 0 };
      if (sim.turnover_pct !== "") params.turnover_pct = Number(sim.turnover_pct);
      if (sim.absenteisme_pct !== "") params.absenteisme_pct = Number(sim.absenteisme_pct);
      if (sim.mobilite_pct !== "") params.mobilite_pct = Number(sim.mobilite_pct);
      const r = await getProjection(params);
      setProj((r && r.data) || null);
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const fmt = (n) => (n != null ? Number(n).toLocaleString("fr-FR") : "—");
  const field = { height: 38, width: 110, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", outline: "none" };

  const { data, loading, error, reload } = useAsync(async () => {
    const [t_res, b_res, d_res, emp_res, ind_res] = await Promise.all([
      getDashboardRisques({ type: "turnover" }),
      getDashboardRisques({ type: "burnout" }),
      getDashboardRisques({ type: "desengagement" }),
      getEmployees(),
      getDashboardIndicateurs()
    ]);
    return {
      turnover: (t_res && t_res.data) || [],
      burnout: (b_res && b_res.data) || [],
      desengagement: (d_res && d_res.data) || [],
      employees: (emp_res && emp_res.data) || [],
      indicateurs: (ind_res && ind_res.data) || []
    };
  });

  // Map employee -> department
  const deptById = {};
  for (const e of (data?.employees || [])) {
    deptById[e.id] = e.department || t("pa.unassigned");
  }

  // Helper function to build distribution data
  const buildDist = (riskData) => {
    const counts = { high: 0, mid: 0, low: 0 };
    for (const r of riskData) counts[r.niveau] = (counts[r.niveau] || 0) + 1;
    return [
      { niveau: "high", label: t("dis.high"), n: counts.high },
      { niveau: "mid", label: t("dis.mid"), n: counts.mid },
      { niveau: "low", label: t("dis.low"), n: counts.low },
    ];
  };

  // Helper function to build risk by department data
  const buildDeptDist = (riskData) => {
    const byDept = {};
    for (const r of riskData) {
      if (r.niveau !== "high" && r.niveau !== "mid") continue; // Focus on risks
      const d = deptById[r.employee_id] || t("pa.unassigned");
      if (!byDept[d]) byDept[d] = { dept: d, high: 0, mid: 0 };
      byDept[d][r.niveau]++;
    }
    return Object.values(byDept).sort((a, b) => (b.high + b.mid) - (a.high + a.mid)).slice(0, 5); // top 5
  };

  const distTurnover = buildDist(data?.turnover || []);
  const distBurnout = buildDist(data?.burnout || []);
  const distDesengagement = buildDist(data?.desengagement || []);

  const deptTurnover = buildDeptDist(data?.turnover || []);
  const deptBurnout = buildDeptDist(data?.burnout || []);
  const deptDesengagement = buildDeptDist(data?.desengagement || []);

  // Custom compare chart (Turnover vs Desengagement)
  const compareToDesengagement = distTurnover.map((d, i) => ({
    label: d.label,
    turnover: d.n,
    desengagement: distDesengagement[i]?.n || 0
  }));

  // Absenteeism historical indicator
  const seriesAbs = (data?.indicateurs || []).filter((x) => x.type === "absenteisme").map((x) => ({ m: x.periode, v: x.valeur }));

  const tabStyle = (active) => ({
    padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14,
    borderBottom: active ? "3px solid var(--gold)" : "3px solid transparent",
    color: active ? "var(--ink)" : "var(--muted)", transition: "all 0.2s"
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("pa.title")}</h1>
        <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--line)" }}>
          <div style={tabStyle(activeTab === "turnover")} onClick={() => setActiveTab("turnover")}>{t("pa.tabTurnover")}</div>
          <div style={tabStyle(activeTab === "burnout")} onClick={() => setActiveTab("burnout")}>{t("pa.tabBurnout")}</div>
          <div style={tabStyle(activeTab === "desengagement")} onClick={() => setActiveTab("desengagement")}>{t("pa.tabDeseng")}</div>
          <div style={tabStyle(activeTab === "simulation")} onClick={() => setActiveTab("simulation")}>{t("pa.tabSim")}</div>
        </div>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        
        {/* --- TAB: TURNOVER --- */}
        {activeTab === "turnover" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Graph 1: Distribution */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.distTurnover")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distTurnover} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="n" radius={[4, 4, 0, 0]} name={t("pa.employees")}>
                      {distTurnover.map((d) => <Cell key={d.niveau} fill={COLORS[d.niveau]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Graph 2: Par département */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.byDept")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptTurnover} layout="vertical" margin={{ top: 6, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="dept" type="category" stroke="var(--ink)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="high" stackId="a" fill="var(--danger)" name={t("dis.high")} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="mid" stackId="a" fill="#9a6b12" name={t("pa.moderate")} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Graph 3: Turnover vs Desengagement */}
            <Card style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.compareTD")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareToDesengagement} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="turnover" fill="var(--gold)" radius={[4, 4, 0, 0]} name={t("pa.tabTurnover")} />
                    <Bar dataKey="desengagement" fill="#5865F2" radius={[4, 4, 0, 0]} name={t("pa.tabDeseng")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB: BURNOUT --- */}
        {activeTab === "burnout" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Graph 1: Distribution */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.distBurnout")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distBurnout} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="n" radius={[4, 4, 0, 0]} name={t("pa.employees")}>
                      {distBurnout.map((d) => <Cell key={d.niveau} fill={COLORS[d.niveau]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Graph 2: Par département */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.byDept")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptBurnout} layout="vertical" margin={{ top: 6, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="dept" type="category" stroke="var(--ink)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="high" stackId="a" fill="var(--danger)" name={t("dis.high")} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="mid" stackId="a" fill="#9a6b12" name={t("pa.moderate")} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Graph 3: Historique Absentéisme */}
            <Card style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.absHistory")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seriesAbs} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={3} name={t("an.simAbsence")} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB: DESENGAGEMENT --- */}
        {activeTab === "desengagement" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Graph 1: Distribution */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.distDeseng")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distDesengagement} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="n" radius={[4, 4, 0, 0]} name={t("pa.employees")}>
                      {distDesengagement.map((d) => <Cell key={d.niveau} fill={COLORS[d.niveau]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Graph 2: Par département */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.byDept")}</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptDesengagement} layout="vertical" margin={{ top: 6, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="dept" type="category" stroke="var(--ink)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="high" stackId="a" fill="var(--danger)" name={t("dis.high")} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="mid" stackId="a" fill="#9a6b12" name={t("pa.moderate")} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}


        {/* --- TAB: SIMULATION --- */}
        {activeTab === "simulation" && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pa.simTitle")}</div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simTurnover")}<br />
                <input type="number" value={sim.turnover_pct} placeholder={"auto"} onChange={(e) => setSim({ ...sim, turnover_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simHiring")}<br />
                <input type="number" value={sim.hiring_per_month} onChange={(e) => setSim({ ...sim, hiring_per_month: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simRaise")}<br />
                <input type="number" value={sim.raise_pct} onChange={(e) => setSim({ ...sim, raise_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simAbsence")}<br />
                <input type="number" value={sim.absenteisme_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, absenteisme_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simMobility")}<br />
                <input type="number" value={sim.mobilite_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, mobilite_pct: e.target.value })} style={field} /></label>
              <button onClick={runSim} disabled={busy} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                <Play size={16} /> {busy ? t("common.loading") : t("pa.simulate")}
              </button>
            </div>
            {proj && proj.totaux && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, marginTop: 24 }}>
                {[
                  { label: t("pa.lostDays"), value: fmt(proj.totaux.jours_absence) },
                  { label: t("pa.absCost"), value: `${fmt(proj.totaux.cout_absenteisme)} €` },
                  { label: t("pa.mobDone"), value: fmt(proj.totaux.mobilites_internes) },
                ].map((x) => (
                  <div key={x.label} style={{ flex: "1 1 150px", background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{x.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{x.value}</div>
                  </div>
                ))}
              </div>
            )}
            {proj && (
              <div style={{ height: 280, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={proj.projection.map((p) => ({ m: `M${p.mois}`, eff: p.effectif, masse: Math.round(p.masse / 1000) }))} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip /><Legend />
                    <Line yAxisId="l" type="monotone" dataKey="eff" stroke="var(--gold)" strokeWidth={2.5} name={t("pa.headcount")} />
                    <Line yAxisId="r" type="monotone" dataKey="masse" stroke="var(--gold-deep)" strokeWidth={2} strokeDasharray="5 5" name={t("pa.payroll")} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}

      </AsyncBoundary>
    </div>
  );
}
