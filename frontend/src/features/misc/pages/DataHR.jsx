import { Database, Upload } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import KpiCard from "../../../components/KpiCard";

export default function DataHR() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("data.title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <KpiCard label={t("data.quality")} value="96%" />
        <KpiCard label={t("emp.title")} value="248" />
        <KpiCard label="Sources" value="4" />
      </div>
      <Card style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><Database size={20} /></div>
        <div style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{t("data.title")}</div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          <Upload size={16} /> {t("data.import")}
        </button>
      </Card>
    </div>
  );
}
