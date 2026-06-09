import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import { AI_USAGE_TREND, CRITICAL_EVENTS } from "../../../mock/mockData";
import { getAiUsage, getAiEvents } from "../../../app/api/services";

const tone = { high: "danger", med: "warning", low: "info" };
const key = { high: "al.high", med: "al.med", low: "al.low" };

export default function Supervision() {
  const { t, lang } = useI18n();

  const [usageData, setUsageData] = useState(AI_USAGE_TREND);
  const [eventsData, setEventsData] = useState(CRITICAL_EVENTS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAiUsage(), getAiEvents()])
      .then(([resUsage, resEvents]) => {
        if (!cancelled) {
          if (resUsage.data) setUsageData(resUsage.data);
          if (resEvents.data) setEventsData(resEvents.data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("nav.supervision")}</h1>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <KpiCard label={t("adm.kpi.refused")} value="7" sub="24h" />
        <KpiCard label={t("adm.kpi.sensitive")} value="3" sub="24h" />
        <KpiCard label={t("adm.kpi.openAlerts")} value="2" />
        <KpiCard label={t("adm.kpi.uptime")} value="99,9%" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("adm.aiUsage")}</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
                <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("adm.events")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {eventsData.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", width: 42 }}>{e.time}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{typeof e.type === 'string' ? e.type : e.type[lang]}</span>
                <Badge tone={tone[e.severity]}>{t(key[e.severity])}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
