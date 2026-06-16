import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getAuditLogs } from "../../../lib/api";

const tone = { INSERT: "success", UPDATE: "warning", DELETE: "danger" };
const fmt = (iso, lang) =>
  iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—";

// Journal d'audit : mutations tracées automatiquement (GET /audit, ADMIN).
export default function Audit() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getAuditLogs({ limit: 200 });
    return (res && res.data) || [];
  });
  const rows = data || [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("aud.title")}</h1>
      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!rows.length} emptyLabel={t("aud.empty")}>
        <Card style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1.1fr 1.3fr 1fr", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("ia.time")}</span><span>{t("aud.action")}</span><span>{t("aud.entity")}</span><span>{t("aud.actor")}</span><span>{t("aud.ip")}</span>
          </div>
          {rows.map((e, i) => (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 1.1fr 1.3fr 1fr", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{fmt(e.date, lang)}</span>
              <Badge tone={tone[e.action] || "info"}>{e.action}</Badge>
              <span style={{ fontSize: 13, color: "var(--ink)" }} title={e.id_entite ? `#${e.id_entite}` : ""}>
                {e.entite}{e.id_entite ? <span style={{ color: "var(--muted)" }}> #{e.id_entite}</span> : null}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{e.actor || t("aud.system")}</span>
              <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{e.ip || "—"}</span>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
