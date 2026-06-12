import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import { TURNOVER_TREND, HEADCOUNT_BY_DEPT, TEAM_ABSENCE_WEEK } from "../../../mock/mockData";

export default function DashboardRh() {
  const { t } = useI18n();
  const { role } = useSession();
  const isManager = role === ROLES.MANAGER;
  const isExec = role === ROLES.RH || role === ROLES.DIRECTION;
  const isMed = role === ROLES.MEDECINE;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("nav.dashboard")}</h1>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
      </div>

      {/* KPI adaptés au rôle */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 20 }}>
        {isManager && (<>
          <KpiCard label={t("rh.kpi.teamHead")} value="12" />
          <KpiCard label={t("rh.kpi.absent")} value="2" />
          <KpiCard label={t("rh.kpi.signals")} value="1" sub="▲" />
          <KpiCard label={t("rh.kpi.toValidate")} value="3" />
        </>)}
        {isExec && (<>
          <KpiCard label={t("rh.kpi.totalHead")} value="248" />
          <KpiCard label={t("rh.kpi.turnover")} value="8,2%" sub="▼ -0,3" />
          <KpiCard label={t("rh.kpi.payroll")} value="1,93 M€" sub="▲" />
          <KpiCard label={t("rh.kpi.engagement")} value="84%" />
        </>)}
        {isMed && (<>
          <KpiCard label={t("rh.kpi.signals")} value="3" />
          <KpiCard label={t("rh.kpi.engagement")} value="84%" />
        </>)}
      </div>

      {/* Graphiques adaptés */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            {isManager ? t("rh.teamAbsence") : t("rh.turnoverTrend")}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              {isManager ? (
                <BarChart data={TEAM_ABSENCE_WEEK} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={TURNOVER_TREND} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} domain={[6, 10]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="real" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3 }} name={t("an.actual")} />
                  <Line type="monotone" dataKey="pred" stroke="var(--gold-deep)" strokeDasharray="5 5" strokeWidth={2} dot={false} name={t("an.predicted")} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
            {isExec || isMed ? t("rh.headByDept") : t("rh.recommended")}
          </div>
          {(isExec || isMed) ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={HEADCOUNT_BY_DEPT} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={60} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[t("act.interview"), t("act.adjust")].map((a) => (
                <div key={a} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}>{a}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
