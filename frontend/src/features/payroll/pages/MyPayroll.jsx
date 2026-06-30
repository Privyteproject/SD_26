import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { Wallet, Download, FileText } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMyPayroll, downloadDocument } from "../../../lib/api";

const mad = (n) => `${Number(n || 0).toLocaleString("fr-MA")} MAD`;

// Paie self-service du collaborateur : SON salaire et SES bulletins uniquement (§2 « paie »).
export default function MyPayroll() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => (await getMyPayroll()).data || {});
  const actuel = data?.actuel;
  const historique = data?.historique || [];
  const bulletins = data?.bulletins || [];

  const series = historique.map((h) => ({
    m: (h.date_effet || "").slice(0, 7), v: Math.round(h.montant), motif: h.motif,
  }));
  const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("pay.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("pay.sub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <KpiCard label={t("pay.current")} value={actuel ? mad(actuel.montant) : "—"} sub={actuel ? `${t("pay.asOf")} ${fmtDay(actuel.date_effet)}` : ""} />
          <KpiCard label={t("pay.changes")} value={historique.length} />
          <KpiCard label={t("pay.payslips")} value={bulletins.length} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
          {/* Évolution du salaire */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("pay.evolution")}</div>
            <div style={{ height: 220 }}>
              {series.length === 0 ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>{t("common.none")}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
                    <XAxis dataKey="m" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={64}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => mad(v)} />
                    <Line type="stepAfter" dataKey="v" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gold)" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Détail des paliers */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {historique.slice().reverse().map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                  <span style={{ color: "var(--muted)" }}>{fmtDay(h.date_effet)} · {h.motif || "—"}</span>
                  <b style={{ color: "var(--ink)" }}>{mad(h.montant)}</b>
                </div>
              ))}
            </div>
          </Card>

          {/* Bulletins */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("pay.payslips")}</div>
            {bulletins.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("pay.noPayslips")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bulletins.map((b) => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center", flexShrink: 0 }}><FileText size={16} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nom}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDay(b.date)}</div>
                    </div>
                    <button onClick={() => downloadDocument(b.id)} className="sd-btn sd-btn--ghost sd-btn--sm" title={t("pay.download")}>
                      <Download size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)" }}>
              <Wallet size={14} /> {t("pay.privacy")}
            </div>
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
