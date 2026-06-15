import { ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getAiLogs } from "../../../lib/api";

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function SupervisionIA() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(() => getAiLogs());
  const logs = (data && data.data) || [];
  const stats = (data && data.meta) || {};

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 10px" }}>{t("ia.title")}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
        <ShieldCheck size={16} color="var(--gold-deep)" /> {t("ia.note")}
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
          <KpiCard label={t("ia.interactions")} value={stats.count ?? 0} />
          <KpiCard label={t("ia.totalTokens")} value={stats.total_tokens ?? 0} />
          <KpiCard label={t("ia.sensitive")} value={stats.sensibles ?? 0} />
        </div>

        {logs.length === 0 ? (
          <Card><div style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{t("ia.empty")}</div></Card>
        ) : (
          <Card style={{ padding: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 0.7fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <span>{t("ia.time")}</span><span>{t("ia.role")}</span><span>{t("ia.prompt")}</span><span>{t("ia.tokens")}</span><span>{t("ia.verdict")}</span>
            </div>
            {logs.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr 0.7fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{fmt(l.date, lang)}</span>
                <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{(l.role && ROLE_LABELS[l.role]?.[lang]) || l.email || "—"}</span>
                <span style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.prompt}>{l.prompt}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{l.tokens ?? "—"}</span>
                <Badge tone={l.sensible ? "warning" : "success"}>{l.sensible ? t("ia.sensible") : t("ia.ok")}</Badge>
              </div>
            ))}
          </Card>
        )}
      </AsyncBoundary>
    </div>
  );
}
