import { useState } from "react";
import { ShieldCheck, Eye, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getAiLogs, getAiSecurityStats, getAiLogDetail } from "../../../lib/api";

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function SupervisionIA() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const [logs, sec] = await Promise.all([getAiLogs(), getAiSecurityStats().catch(() => null)]);
    return { logs: (logs && logs.data) || [], stats: (logs && logs.meta) || {}, sec: (sec && sec.data) || {} };
  });
  const logs = data?.logs || [];
  const stats = data?.stats || {};
  const sec = data?.sec || {};
  const [detail, setDetail] = useState(null);
  const reveal = async (id) => {
    try { const r = await getAiLogDetail(id); setDetail((r && r.data) || null); } catch (e) { /* ignore */ }
  };

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

        {/* Indicateurs de sécurité IA */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "4px 0 10px" }}>{t("ia.security")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
          <KpiCard label={t("ia.refus24")} value={sec.refus_24h ?? 0} />
          <KpiCard label={t("ia.refus7")} value={sec.refus_7j ?? 0} />
          <KpiCard label={t("ia.alertsHigh")} value={sec.par_gravite?.high ?? 0} />
          <KpiCard label={t("ia.alertsOpen")} value={sec.alertes_non_resolues ?? 0} />
          <KpiCard label={t("ia.sensitiveRate")} value={`${sec.taux_sensibles ?? 0}%`} />
        </div>

        {logs.length === 0 ? (
          <Card><div style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{t("ia.empty")}</div></Card>
        ) : (
          <Card style={{ padding: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 0.7fr auto auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <span>{t("ia.time")}</span><span>{t("ia.role")}</span><span>{t("ia.content")}</span><span>{t("ia.tokens")}</span><span>{t("ia.verdict")}</span><span></span>
            </div>
            {logs.map((l, i) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.4fr 0.7fr auto auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{fmt(l.date, lang)}</span>
                <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{(l.role && ROLE_LABELS[l.role]?.[lang]) || l.user || "—"}</span>
                <span style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>{t("ia.masked")} ({l.prompt_len ?? 0})</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{l.tokens ?? "—"}</span>
                <Badge tone={l.sensible ? "warning" : "success"}>{l.sensible ? t("ia.sensible") : t("ia.ok")}</Badge>
                <button onClick={() => reveal(l.id)} title={t("ia.view")} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Eye size={15} /></button>
              </div>
            ))}
          </Card>
        )}
      </AsyncBoundary>

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t("ia.detailTitle")}</div>
              <button onClick={() => setDetail(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{detail.user} · {fmt(detail.date, lang)} · {detail.tokens ?? "—"} tokens · {t("ia.tracedAccess")}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>{t("ia.prompt")}</div>
            <div style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-wrap", margin: "4px 0 12px" }}>{detail.prompt}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>{t("ia.response") || "Réponse"}</div>
            <div style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, fontSize: 13.5, color: "var(--ink)", whiteSpace: "pre-wrap", marginTop: 4 }}>{detail.reponse}</div>
          </div>
        </div>
      )}
    </div>
  );
}
