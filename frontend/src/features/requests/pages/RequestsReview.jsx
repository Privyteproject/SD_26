import { useState } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { getAllRequests, setRequestStatus } from "../../../lib/requestsStore";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import EmptyState from "../../../components/EmptyState";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };

export default function RequestsReview() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState(() => getAllRequests());
  const sorted = [...items].sort((a, b) => (b.status === "pending") - (a.status === "pending"));
  const act = (id, status) => setItems(setRequestStatus(id, status));

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("reqr.title")}</h1>
      <Card style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("reqr.requester")}</span><span>{t("req.type")}</span><span>{t("req.date")}</span><span>{t("req.status")}</span><span></span>
        </div>
        {sorted.length === 0 ? <EmptyState title={t("reqr.empty")} /> : sorted.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1fr 1fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.userName || "—"}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{r.type[lang]}<span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{r.detail || ""}</span></span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.date}</span>
            <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
            <span style={{ display: "flex", gap: 6 }}>
              <button onClick={() => act(r.id, "validated")} disabled={r.status === "validated"} title={t("reqr.approve")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: r.status === "validated" ? "var(--line)" : "var(--success)", cursor: r.status === "validated" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} /></button>
              <button onClick={() => act(r.id, "refused")} disabled={r.status === "refused"} title={t("reqr.refuse")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: r.status === "refused" ? "var(--line)" : "var(--danger)", cursor: r.status === "refused" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
