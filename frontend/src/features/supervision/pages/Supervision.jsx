import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import ModelEvaluation from "../components/ModelEvaluation";
import { useAsync } from "../../../lib/useAsync";
import { getAiSecurityStats, getAiUsageTrend, getAiEvents } from "../../../lib/api";

// La gravité backend est low/mid/high ; on tolère aussi "med".
const tone = { high: "danger", mid: "warning", med: "warning", low: "info" };
const sevKey = { high: "al.high", mid: "al.med", med: "al.med", low: "al.low" };

export default function Supervision() {
  const { t } = useI18n();

  const { data, loading, error, reload } = useAsync(async () => {
    const [sec, trend, events] = await Promise.all([
      getAiSecurityStats().catch(() => null),
      getAiUsageTrend(14).catch(() => null),
      getAiEvents(8).catch(() => null),
    ]);
    return {
      sec: (sec && sec.data) || {},
      trend: (trend && trend.data) || [],
      events: (events && events.data) || [],
    };
  });

  const sec = data?.sec || {};
  const trend = data?.trend || [];
  const events = data?.events || [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("nav.supervision")}</h1>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          <KpiCard label={t("adm.kpi.refused")} value={sec.refus_24h ?? 0} sub="24h" />
          <KpiCard label={t("adm.kpi.sensitive")} value={sec.sensibles ?? 0} sub={`${sec.taux_sensibles ?? 0}%`} />
          <KpiCard label={t("adm.kpi.openAlerts")} value={sec.alertes_non_resolues ?? 0} />
          <KpiCard label={t("adm.kpi.interactions")} value={sec.interactions ?? 0} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("adm.aiUsage")}</div>
            <div style={{ height: 220 }}>
              {trend.every((d) => !d.count) ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>{t("common.none")}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                    <XAxis dataKey="jour" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("adm.events")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {events.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.none")}</div>}
              {events.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", width: 42, flexShrink: 0 }}>{e.time}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.type}</span>
                  <Badge tone={tone[e.severity] || "info"} style={{ flexShrink: 0 }}>{t(sevKey[e.severity] || "al.low")}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Évaluation & équité des modèles ML (Random Forest) */}
        <ModelEvaluation />
      </AsyncBoundary>
    </div>
  );
}
