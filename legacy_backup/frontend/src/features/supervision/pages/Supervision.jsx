import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import { AI_USAGE_TREND, CRITICAL_EVENTS } from "../../../mock/mockData";

const tone = { high: "danger", med: "warning", low: "info" };
const key = { high: "al.high", med: "al.med", low: "al.low" };

export default function Supervision() {
  const { t, lang } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("nav.supervision")}</h1>
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
              <BarChart data={AI_USAGE_TREND} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
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
            {CRITICAL_EVENTS.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", width: 42 }}>{e.time}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{e.type[lang]}</span>
                <Badge tone={tone[e.severity]}>{t(key[e.severity])}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
