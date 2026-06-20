import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardIndicateurs, getDashboardRisques } from "../../../lib/api";

const COLORS = { high: "var(--danger)", mid: "#9a6b12", low: "#2e8c57" };

// Absentéisme : série trimestrielle réelle + distribution du risque de burnout (ML).
export default function Absenteeism() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const [ind, bn] = await Promise.all([getDashboardIndicateurs(), getDashboardRisques({ type: "burnout" })]);
    return { ind: (ind && ind.data) || [], burnout: (bn && bn.data) || [] };
  });
  const series = (data?.ind || []).filter((x) => x.type === "absenteisme").map((x) => ({ m: x.periode, v: x.valeur }));
  const c = { high: 0, mid: 0, low: 0 };
  for (const s of (data?.burnout || [])) c[s.niveau] = (c[s.niveau] || 0) + 1;
  const dist = [
    { niveau: "high", label: t("dis.high"), n: c.high },
    { niveau: "mid", label: t("dis.mid"), n: c.mid },
    { niveau: "low", label: t("dis.low"), n: c.low },
  ];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("an.absenteeism")}</h1>
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.absenteeism")} (%) — {t("rh.indicators")}</div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} name={t("an.absenteeism")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.burnoutDist")}</div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="n" radius={[4, 4, 0, 0]} name="burnout">
                    {dist.map((d) => <Cell key={d.niveau} fill={COLORS[d.niveau]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
