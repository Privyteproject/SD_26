import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardRh, getDashboardIndicateurs, getEmployees } from "../../../lib/api";

const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const riskTone = { high: "danger", mid: "warning", low: "success" };

export default function DashboardRh() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const isManager = role === ROLES.MANAGER;
  const isExec = role === ROLES.RH || role === ROLES.DIRECTION || role === ROLES.ADMIN;
  const isMed = role === ROLES.MEDECINE;

  const { data, loading, error, reload } = useAsync(async () => {
    const [rh, ind, emps] = await Promise.all([
      getDashboardRh(),
      getDashboardIndicateurs(),
      getEmployees(),
    ]);
    return {
      rh: (rh && rh.data) || {},
      indicateurs: (ind && ind.data) || [],
      employees: (emps && emps.data) || [],
    };
  });

  const rh = data?.rh || {};
  const ind = rh.indicateurs || {};
  const risques = rh.risques || {};
  const turnover = ind.turnover?.valeur;
  const absenteeism = ind.absenteisme?.valeur;
  const engagement = ind.engagement?.valeur;
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
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
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
      </AsyncBoundary>
    </div>
  );
}
