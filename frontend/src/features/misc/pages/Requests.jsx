import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import EmptyState from "../../../components/EmptyState";
import { REQUESTS } from "../../../mock/mockData";
import { getAbsences } from "../../../app/api/services";

const tone = { pending: "warning", approved: "success", validated: "success", rejected: "danger", refused: "danger" };
const key = { pending: "st.pending", approved: "st.validated", validated: "st.validated", rejected: "st.refused", refused: "st.refused" };

// Map backend absence types to display labels
const TYPE_LABELS = {
  conge_annuel: { fr: "Congé annuel", en: "Annual leave" },
  conge_maladie: { fr: "Congé maladie", en: "Sick leave" },
  rtt: { fr: "RTT", en: "RTT" },
  conge_sans_solde: { fr: "Congé sans solde", en: "Unpaid leave" },
  conge_maternite: { fr: "Congé maternité", en: "Maternity leave" },
};

export default function Requests() {
  const { t, lang } = useI18n();
  const [requests, setRequests] = useState(REQUESTS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAbsences()
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.data || []).map((a) => ({
          id: a.id,
          type: TYPE_LABELS[a.type] || { fr: a.type, en: a.type },
          date: `${a.start_date} → ${a.end_date}`,
          status: a.status,
        }));
        setRequests(mapped.length > 0 ? mapped : REQUESTS);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

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

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginTop: 10 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}

      <Card style={{ marginTop: 20, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("req.type")}</span><span>{t("req.date")}</span><span>{t("req.status")}</span>
        </div>
        {requests.length === 0 ? (
          <EmptyState title={t("req.empty")} />
        ) : requests.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, alignItems: "center", padding: "15px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.type[lang]}</span>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{r.date}</span>
            <Badge tone={tone[r.status]}>{t(key[r.status] || "st.pending")}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
