import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Lock } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { can } from "../../../lib/rbac";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardAnalytics } from "../../../lib/api";

// Masse salariale : somme du dernier salaire connu des actifs, ventilée par site (dynamique).
export default function Payroll() {
  const { t } = useI18n();
  const { role } = useSession();
  const allowed = can(role, "payroll.view");

  const { data, loading, error, reload } = useAsync(
    async () => (allowed ? ((await getDashboardAnalytics()).data || {}) : {}),
    [allowed]
  );
  const masse = data?.masse_salariale || {};
  const bySite = (masse.by_site || []).map((s) => ({ m: s.site, v: Math.round((s.mensuel || 0) / 1000) }));

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("an.payroll")} — {t("an.monthlyBySite")} (k MAD)</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("an.totalMonthly")} : <b style={{ color: "var(--ink)" }}>{Math.round((masse.mensuelle || 0) / 1000).toLocaleString()} k MAD</b></div>
          </div>
          <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!bySite.length} emptyLabel={t("common.empty")}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySite} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="var(--gold)" radius={[4, 4, 0, 0]} name="k MAD/mois" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AsyncBoundary>
        </Card>
      )}
    </div>
  );
}
