import { Plus } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import EmptyState from "../../../components/EmptyState";
import { REQUESTS } from "../../../mock/mockData";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };

export default function Requests() {
  const { t, lang } = useI18n();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("req.title")}</h1>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={17} /> {t("req.new")}
        </button>
      </div>

      <Card style={{ marginTop: 20, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("req.type")}</span><span>{t("req.date")}</span><span>{t("req.status")}</span>
        </div>
        {REQUESTS.length === 0 ? (
          <EmptyState title={t("req.empty")} />
        ) : REQUESTS.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, alignItems: "center", padding: "15px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.type[lang]}</span>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{r.date}</span>
            <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
