import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Play } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import { TURNOVER_TREND } from "../../../mock/mockData";

export default function Turnover() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("an.turnover")}</h1>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("rh.turnoverTrend")}</div>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--gold)", background: "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            <Play size={15} color="var(--gold-deep)" /> {t("act.simulate")}
          </button>
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TURNOVER_TREND} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} domain={[6, 10]} />
              <Tooltip />
              <Area type="monotone" dataKey="real" stroke="var(--gold)" strokeWidth={2.5} fill="url(#g1)" name={t("an.actual")} />
              <Area type="monotone" dataKey="pred" stroke="var(--gold-deep)" strokeWidth={2} strokeDasharray="5 5" fill="none" name={t("an.predicted")} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
