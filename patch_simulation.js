const fs = require('fs');
let code = fs.readFileSync('frontend/src/features/analytics/pages/PredictiveAnalytics.jsx', 'utf8');

// Add Play icon import
code = code.replace(/import { ResponsiveContainer/, "import { Play } from \"lucide-react\";\nimport { ResponsiveContainer");

// Add getProjection import
code = code.replace(/getEmployees } from "\.\.\/\.\.\/\.\.\/lib\/api";/, "getEmployees, getProjection } from \"../../../lib/api\";");

// Add Tab Key
code = code.replace(/const TAB_KEYS = \["turnover", "burnout", "desengagement"\];/, "const TAB_KEYS = [\"turnover\", \"burnout\", \"desengagement\", \"simulation\"];");

// Add States inside component
const stateCode = `
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

  const { data, loading,`;
code = code.replace(/  const \{ data, loading,/, stateCode);

// Add Tab Header
const tabHeader = `<div style={tabStyle(activeTab === "simulation")} onClick={() => setActiveTab("simulation")}>Simulation RH</div>`;
code = code.replace(/<div style=\{tabStyle\(activeTab === "desengagement"\)\} onClick=\{\(\) => setActiveTab\("desengagement"\)\}>Désengagement<\/div>/, `<div style={tabStyle(activeTab === "desengagement")} onClick={() => setActiveTab("desengagement")}>Désengagement</div>\n          ${tabHeader}`);

// Add Simulation Tab Content before </AsyncBoundary>
const tabContent = `
        {/* --- TAB: SIMULATION --- */}
        {activeTab === "simulation" && (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Simulation de Scénarios RH (Projections ML)</div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Turnover annuel (%)<br />
                <input type="number" value={sim.turnover_pct} placeholder={"auto"} onChange={(e) => setSim({ ...sim, turnover_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Embauches / mois<br />
                <input type="number" value={sim.hiring_per_month} onChange={(e) => setSim({ ...sim, hiring_per_month: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Augmentations (%)<br />
                <input type="number" value={sim.raise_pct} onChange={(e) => setSim({ ...sim, raise_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Absentéisme (%)<br />
                <input type="number" value={sim.absenteisme_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, absenteisme_pct: e.target.value })} style={field} /></label>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Mobilité interne (%)<br />
                <input type="number" value={sim.mobilite_pct} placeholder="auto" onChange={(e) => setSim({ ...sim, mobilite_pct: e.target.value })} style={field} /></label>
              <button onClick={runSim} disabled={busy} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                <Play size={16} /> {busy ? t("common.loading") : "Simuler"}
              </button>
            </div>
            {proj && proj.totaux && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, marginTop: 24 }}>
                {[
                  { label: "Jours d'absence perdus", value: fmt(proj.totaux.jours_absence) },
                  { label: "Coût de l'absentéisme", value: \`\${fmt(proj.totaux.cout_absenteisme)} €\` },
                  { label: "Mobilités réalisées", value: fmt(proj.totaux.mobilites_internes) },
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
                  <LineChart data={proj.projection.map((p) => ({ m: \`M\${p.mois}\`, eff: p.effectif, masse: Math.round(p.masse / 1000) }))} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip /><Legend />
                    <Line yAxisId="l" type="monotone" dataKey="eff" stroke="var(--gold)" strokeWidth={2.5} name="Effectifs" />
                    <Line yAxisId="r" type="monotone" dataKey="masse" stroke="var(--gold-deep)" strokeWidth={2} strokeDasharray="5 5" name="Masse salariale (k€)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
`;
code = code.replace(/      <\/AsyncBoundary>/, tabContent + "\n      </AsyncBoundary>");

fs.writeFileSync('frontend/src/features/analytics/pages/PredictiveAnalytics.jsx', code);
