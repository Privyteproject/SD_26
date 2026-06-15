import { FileBarChart, Download } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import { REPORTS } from "../../../mock/mockData";

export default function Reports() {
  const { t, lang } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("rep.title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileBarChart size={20} /></div>
            <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{r.name[lang]}</div>
            <button style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid var(--gold)", background: "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <Download size={15} color="var(--gold-deep)" /> {t("rep.export")}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
