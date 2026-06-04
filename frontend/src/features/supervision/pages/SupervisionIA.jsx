import { ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { IA_LOGS } from "../../../mock/mockData";

const tone = { allowed: "success", refused: "danger", flagged: "warning" };
const key = { allowed: "ia.allowed", refused: "ia.refused", flagged: "ia.flagged" };

export default function SupervisionIA() {
  const { t, lang } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 10px" }}>{t("ia.title")}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
        <ShieldCheck size={16} color="var(--gold-deep)" /> {t("ia.note")}
      </div>
      <Card style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.6fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("ia.time")}</span><span>{t("ia.role")}</span><span>{t("ia.type")}</span><span>{t("ia.verdict")}</span>
        </div>
        {IA_LOGS.map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.6fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{l.time}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{ROLE_LABELS[l.role][lang]}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{l.type[lang]}</span>
            <Badge tone={tone[l.verdict]}>{t(key[l.verdict])}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
