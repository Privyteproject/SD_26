import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardRh, getDashboardIndicateurs, getEmployees, calculateRisques, trainRiskModels, getRiskPrediction, getDashboardAnalytics, batchScoreRisks } from "../../../lib/api";

const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const riskTone = { high: "danger", mid: "warning", low: "success" };

export default function DashboardRh() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const isManager = role === ROLES.MANAGER;
  const isExec = role === ROLES.RH || role === ROLES.DIRECTION || role === ROLES.ADMIN;
  const isMed = role === ROLES.MEDECINE;

  const { data, loading, error, reload } = useAsync(async () => {
    const [rh, ind, emps, ana] = await Promise.all([
      getDashboardRh(),
      getDashboardIndicateurs(),
      getEmployees(),
      getDashboardAnalytics().catch(() => null),
    ]);
    return {
      rh: (rh && rh.data) || {},
      indicateurs: (ind && ind.data) || [],
      employees: (emps && emps.data) || [],
      analytics: (ana && ana.data) || {},
    };
  });

  const [calc, setCalc] = useState(false);
  const recalc = async () => {
    setCalc(true);
    try { await calculateRisques(); reload(); } catch (e) { /* ignore */ } finally { setCalc(false); }
  };

  // Prédictions ML (Random Forest)
  const [training, setTraining] = useState(false);
  const [selEmp, setSelEmp] = useState("");
  const [pred, setPred] = useState(null);
  const [predBusy, setPredBusy] = useState(false);
  const [trainRes, setTrainRes] = useState(null);
  const trainMl = async () => {
    setTraining(true);
    try { const r = await trainRiskModels(); setTrainRes((r && r.data && r.data.models) || null); }
    catch (e) { /* ignore */ } finally { setTraining(false); }
  };
  const [batching, setBatching] = useState(false);
  const batchScore = async () => {
    setBatching(true);
    try { await batchScoreRisks(); reload(); } catch (e) { /* ignore */ } finally { setBatching(false); }
  };
  const predictEmp = async (mat) => {
    setSelEmp(mat); setPred(null);
    if (!mat) return;
    setPredBusy(true);
    try { const r = await getRiskPrediction(mat); setPred((r && r.data) || null); }
    catch (e) { setPred(null); } finally { setPredBusy(false); }
  };

  const rh = data?.rh || {};
  const ind = rh.indicateurs || {};
  const risques = rh.risques || {};
  const analytics = data?.analytics || {};
  const turnover = ind.turnover?.valeur;
  const absenteeism = ind.absenteisme?.valeur;
  const engagement = ind.engagement?.valeur;
  const mobilite = ind.mobilite?.valeur;
  const anomalies = rh.anomalies || [];
  const highRisks = risques.by_niveau?.high ?? 0;

  // Effectif par département (calculé depuis la liste réelle des employés).
  const byDept = Object.values(
    (data?.employees || []).reduce((acc, e) => {
      const d = e.department || (e.department_id != null ? String(e.department_id) : "—");
      acc[d] = acc[d] || { d, v: 0 };
      acc[d].v += 1;
      return acc;
    }, {})
  );

  // Indicateurs RH par période (turnover / absentéisme / engagement).
  const byPeriode = {};
  for (const i of (data?.indicateurs || [])) {
    byPeriode[i.periode] = byPeriode[i.periode] || { periode: i.periode };
    byPeriode[i.periode][i.type] = i.valeur;
  }
  const indTrend = Object.values(byPeriode).sort((a, b) => a.periode.localeCompare(b.periode));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("nav.dashboard")}</h1>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
        {(isExec || isMed) && (
          <button onClick={recalc} disabled={calc} className="sd-btn sd-btn--outline" style={{ marginLeft: "auto" }}>
            <Sparkles size={16} /> {calc ? t("common.loading") : t("rh.recalcRisk")}
          </button>
        )}
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {/* Détection d'écarts inhabituels */}
        {anomalies.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {anomalies.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: a.severite === "high" ? "var(--danger)" : "#9a6b12", background: a.severite === "high" ? "rgba(180,64,46,.10)" : "rgba(180,120,20,.12)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px" }}>
                ⚠️ {a.message}
              </div>
            ))}
          </div>
        )}

        {/* KPI adaptés au rôle, alimentés par /dashboard/rh */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 20 }}>
          {isManager && (<>
            <KpiCard label={t("rh.kpi.teamHead")} value={rh.headcount ?? "—"} />
            <KpiCard label={t("rh.kpi.toValidate")} value={rh.pending_absences ?? "—"} />
            <KpiCard label={t("rh.kpi.signals")} value={highRisks} />
            <KpiCard label={t("rh.kpi.engagement")} value={pct(engagement)} />
          </>)}
          {(isExec) && (<>
            <KpiCard label={t("rh.kpi.totalHead")} value={rh.headcount ?? "—"} />
            <KpiCard label={t("rh.kpi.turnover")} value={pct(turnover)} />
            <KpiCard label={t("rh.kpi.absenteeism")} value={pct(absenteeism)} />
            <KpiCard label={t("rh.kpi.engagement")} value={pct(engagement)} />
            <KpiCard label={t("rh.kpi.mobility")} value={pct(mobilite)} />
          </>)}
          {isMed && (<>
            <KpiCard label={t("rh.kpi.signals")} value={highRisks} />
            <KpiCard label={t("rh.kpi.absenteeism")} value={pct(absenteeism)} />
            <KpiCard label={t("rh.kpi.engagement")} value={pct(engagement)} />
            <KpiCard label={t("rh.kpi.pending")} value={rh.pending_absences ?? "—"} />
          </>)}
        </div>

        {/* Graphiques */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("rh.indicators")}</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={indTrend} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="periode" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="turnover" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls name={t("rh.kpi.turnover")} />
                  <Line type="monotone" dataKey="absenteisme" stroke="var(--gold-deep)" strokeWidth={2} dot={{ r: 3 }} connectNulls name={t("rh.kpi.absenteeism")} />
                  <Line type="monotone" dataKey="engagement" stroke="#5b8a72" strokeWidth={2} dot={{ r: 3 }} connectNulls name={t("rh.kpi.engagement")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("rh.headByDept")}</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="d" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* KPIs analytiques : pyramide des âges + répartition par site + masse salariale */}
        {(analytics.pyramide || analytics.sites) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("rh.pyramid")}</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.pyramide || []}>
                    <XAxis dataKey="tranche" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <Tooltip /><Bar dataKey="count" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
                {t("rh.bySite")}
                {analytics.masse_salariale && <span style={{ float: "right", fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>{t("rh.payroll")} : {Math.round((analytics.masse_salariale.total || 0) / 1000).toLocaleString()} k€</span>}
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.sites || []}>
                    <XAxis dataKey="site" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <Tooltip /><Bar dataKey="count" fill="var(--gold-deep)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Top collaborateurs à risque (confidentiel : RH / Médecine / Direction / Admin) */}
        {(isExec || isMed) && (risques.top?.length > 0) && (
          <Card style={{ marginTop: 16, padding: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>{t("rh.topRisks")}</div>
            {risques.top.map((s, i) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: 12, alignItems: "center", padding: "12px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{s.employee_name || s.employee_id}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{s.type}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{Math.round((s.valeur ?? 0) * 100)}%</span>
                <Badge tone={riskTone[s.niveau] || "info"}>{s.niveau}</Badge>
              </div>
            ))}
          </Card>
        )}

        {/* Prédiction de risque par Random Forest (ML) */}
        {(isExec || isMed) && (
          <Card style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("ml.title")}</div>
              <button onClick={trainMl} disabled={training} className="sd-btn sd-btn--outline sd-btn--sm" style={{ marginLeft: "auto" }}>
                <Sparkles size={15} /> {training ? t("common.loading") : t("ml.train")}
              </button>
              <button onClick={batchScore} disabled={batching} className="sd-btn sd-btn--gold sd-btn--sm">
                <Sparkles size={15} /> {batching ? t("common.loading") : t("ml.batch")}
              </button>
            </div>
            {trainRes && (
              <div style={{ marginBottom: 14, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead><tr style={{ color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "4px 8px" }}>Modèle</th><th style={{ padding: "4px 8px" }}>Acc.</th>
                    <th style={{ padding: "4px 8px" }}>Précision</th><th style={{ padding: "4px 8px" }}>Rappel</th>
                    <th style={{ padding: "4px 8px" }}>F1</th><th style={{ padding: "4px 8px" }}>ROC-AUC</th>
                    <th style={{ padding: "4px 8px" }}>TN/FP/FN/TP</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(trainRes).map(([name, m]) => m.trained && (
                      <tr key={name} style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}>
                        <td style={{ padding: "5px 8px", fontWeight: 600 }}>{name}</td>
                        <td style={{ padding: "5px 8px" }}>{m.accuracy}</td><td style={{ padding: "5px 8px" }}>{m.precision}</td>
                        <td style={{ padding: "5px 8px" }}>{m.recall}</td><td style={{ padding: "5px 8px" }}>{m.f1}</td>
                        <td style={{ padding: "5px 8px" }}>{m.roc_auc ?? "—"}</td>
                        <td style={{ padding: "5px 8px", color: "var(--muted)" }}>{`${m.confusion_matrix.tn}/${m.confusion_matrix.fp}/${m.confusion_matrix.fn}/${m.confusion_matrix.tp}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <select value={selEmp} onChange={(e) => predictEmp(e.target.value)} className="sd-field" style={{ maxWidth: 360 }}>
              <option value="">{t("ml.pickEmp")}</option>
              {(data?.employees || []).map((e) => (
                <option key={e.id} value={e.id}>{`${e.prenom || ""} ${e.nom || ""}`.trim() || e.id} ({e.id})</option>
              ))}
            </select>

            {predBusy && <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>}
            {pred && pred.trained === false && <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>{t("ml.notrained")}</div>}
            {pred && pred.risks && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 14 }}>
                {[["turnover", t("ml.turnover")], ["absent", t("ml.absent")], ["mobilite", t("ml.mobilite")]].map(([k, label]) => {
                  const r = pred.risks[k];
                  if (!r) return null;
                  return (
                    <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{Math.round(r.proba * 100)}%</span>
                        <Badge tone={riskTone[r.niveau] || "info"}>{r.niveau}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </AsyncBoundary>
    </div>
  );
}
