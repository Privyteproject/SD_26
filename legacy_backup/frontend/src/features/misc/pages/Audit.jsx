import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import { AUDIT_LOG } from "../../../mock/mockData";

export default function Audit() {
  const { t, lang } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("aud.title")}</h1>
      <Card style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("ia.time")}</span><span>{t("aud.actor")}</span><span>{t("aud.action")}</span>
        </div>
        {AUDIT_LOG.map((e, i) => (
          <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 2fr", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{e.time}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{e.actor}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{e.action[lang]}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
