import { useState } from "react";
import { Play } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Cell, Legend } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardRh, getDashboardRisques, getProjection } from "../../../lib/api";

const COLORS = { high: "var(--danger)", mid: "#9a6b12", low: "#2e8c57" };

// Turnover : taux courant (dynamique) + distribution du risque de départ (modèle ML)
// + comparaison Turnover vs Burnout par niveau.
export default function Turnover() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const [rh, sc, bn] = await Promise.all([
      getDashboardRh(), getDashboardRisques({ type: "turnover" }), getDashboardRisques({ type: "burnout" }),
    ]);
    return { rh: (rh && rh.data) || {}, scores: (sc && sc.data) || [], burnout: (bn && bn.data) || [] };
  });
  const rate = data?.rh?.indicateurs?.turnover?.valeur;
  const counts = { high: 0, mid: 0, low: 0 };
  for (const s of (data?.scores || [])) counts[s.niveau] = (counts[s.niveau] || 0) + 1;
  const cb = { high: 0, mid: 0, low: 0 };
  for (const s of (data?.burnout || [])) cb[s.niveau] = (cb[s.niveau] || 0) + 1;
  const dist = [
    { niveau: "high", label: t("dis.high"), n: counts.high },
    { niveau: "mid", label: t("dis.mid"), n: counts.mid },
    { niveau: "low", label: t("dis.low"), n: counts.low },
  ];
  const compare = [
    { label: t("dis.high"), turnover: counts.high, burnout: cb.high },
    { label: t("dis.mid"), turnover: counts.mid, burnout: cb.mid },
    { label: t("dis.low"), turnover: counts.low, burnout: cb.low },
  ];

  // Simulation de scénario (projection effectifs + masse salariale).
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

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("an.turnover")}</h1>
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("an.currentRate")}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: "var(--ink)", marginTop: 4 }}>{rate != null ? `${rate}%` : "—"}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>{t("an.atRisk")} : <b style={{ color: "var(--danger)" }}>{counts.high}</b></div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.riskDist")} (ML)</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="n" radius={[4, 4, 0, 0]} name={t("an.atRisk")}>
                    {dist.map((d) => <Cell key={d.niveau} fill={COLORS[d.niveau]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Comparaison Turnover vs Burnout (par niveau) */}
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.compare")}</div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip /><Legend />
                <Bar dataKey="turnover" fill="var(--gold)" radius={[4, 4, 0, 0]} name={t("an.turnover")} />
                <Bar dataKey="burnout" fill="var(--gold-deep)" radius={[4, 4, 0, 0]} name="Burnout" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Simulation de scénario RH */}
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.simulate")}</div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simTurnover")}<br />
              <input type="number" value={sim.turnover_pct} placeholder={rate ?? "auto"} onChange={(e) => setSim({ ...sim, turnover_pct: e.target.value })} style={field} /></label>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simHiring")}<br />
              <input type="number" value={sim.hiring_per_month} onChange={(e) => setSim({ ...sim, hiring_per_month: e.target.value })} style={field} /></label>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simRaise")}<br />
              <input type="number" value={sim.raise_pct} onChange={(e) => setSim({ ...sim, raise_pct: e.target.value })} style={field} /></label>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simAbsence")}<br />
              <input type="number" value={sim.absenteisme_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, absenteisme_pct: e.target.value })} style={field} /></label>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("an.simMobility")}<br />
              <input type="number" value={sim.mobilite_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, mobilite_pct: e.target.value })} style={field} /></label>
            <button onClick={runSim} disabled={busy} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
              <Play size={16} /> {busy ? t("common.loading") : t("an.simRun")}
            </button>
          </div>
          {proj && proj.totaux && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { label: t("an.simAbsDays"), value: fmt(proj.totaux.jours_absence) },
                { label: t("an.simAbsCost"), value: `${fmt(proj.totaux.cout_absenteisme)} €` },
                { label: t("an.simMobMoves"), value: fmt(proj.totaux.mobilites_internes) },
              ].map((x) => (
                <div key={x.label} style={{ flex: "1 1 150px", background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{x.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{x.value}</div>
                </div>
              ))}
            </div>
          )}
          {proj && (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={proj.projection.map((p) => ({ m: `M${p.mois}`, eff: p.effectif, masse: Math.round(p.masse / 1000) }))} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="l" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip /><Legend />
                  <Line yAxisId="l" type="monotone" dataKey="eff" stroke="var(--gold)" strokeWidth={2.5} name={t("an.simHeadcount")} />
                  <Line yAxisId="r" type="monotone" dataKey="masse" stroke="var(--gold-deep)" strokeWidth={2} strokeDasharray="5 5" name={t("an.simPayroll")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
