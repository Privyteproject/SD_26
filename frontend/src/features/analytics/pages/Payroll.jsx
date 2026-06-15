import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Lock } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { can } from "../../../lib/rbac";
import Card from "../../../components/Card";
import { PAYROLL_TREND } from "../../../mock/mockData";

export default function Payroll() {
  const { t } = useI18n();
  const { role } = useSession();
  const allowed = can(role, "payroll.view");

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("an.payroll")}</h1>
      {!allowed ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Lock size={22} /></div>
          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t("an.restricted")}</div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 380, margin: "8px auto 0" }}>{t("an.restrictedHint")}</p>
        </Card>
      ) : (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("an.payroll")} (M€)</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PAYROLL_TREND} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} domain={[1.7, 2]} />
                <Tooltip />
                <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
