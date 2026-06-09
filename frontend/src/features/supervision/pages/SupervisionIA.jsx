import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { IA_LOGS } from "../../../mock/mockData";
import { getAiLogs } from "../../../app/api/services";

const tone = { allowed: "success", refused: "danger", flagged: "warning" };
const key = { allowed: "ia.allowed", refused: "ia.refused", flagged: "ia.flagged" };

export default function SupervisionIA() {
  const { t, lang } = useI18n();

  const [logsData, setLogsData] = useState(IA_LOGS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAiLogs()
      .then((res) => {
        if (!cancelled && res.data) setLogsData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 10px" }}>{t("ia.title")}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
        <ShieldCheck size={16} color="var(--gold-deep)" /> {t("ia.note")}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      <Card style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.6fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("ia.time")}</span><span>{t("ia.role")}</span><span>{t("ia.type")}</span><span>{t("ia.verdict")}</span>
        </div>
        {logsData.map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.6fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{l.time}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{ROLE_LABELS[l.role] ? ROLE_LABELS[l.role][lang] : l.role}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{typeof l.type === 'string' ? l.type : l.type[lang]}</span>
            <Badge tone={tone[l.verdict]}>{t(key[l.verdict])}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
