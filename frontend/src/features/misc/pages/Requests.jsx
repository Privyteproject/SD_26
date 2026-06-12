import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { getRequestsByUser, addRequest } from "../../../lib/requestsStore";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import EmptyState from "../../../components/EmptyState";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };
const TYPES = [
  { v: "leave", fr: "Congé payé", en: "Paid leave" },
  { v: "cert", fr: "Attestation de travail", en: "Work certificate" },
  { v: "remote", fr: "Télétravail", en: "Remote work" },
  { v: "advance", fr: "Avance sur salaire", en: "Salary advance" },
];
const inputStyle = { height: 42, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" };

export default function Requests() {
  const { t, lang } = useI18n();
  const { currentUser } = useSession();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(TYPES[0].v);
  const [detail, setDetail] = useState("");

  const refresh = () => setItems(currentUser ? getRequestsByUser(currentUser.id) : []);
  useEffect(refresh, [currentUser]);

  const add = () => {
    const ty = TYPES.find((x) => x.v === type);
    addRequest({ userId: currentUser.id, userName: currentUser.name, type: { fr: ty.fr, en: ty.en }, date: new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB"), detail });
    setDetail(""); setShowForm(false); refresh();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("req.title")}</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          {showForm ? <X size={17} /> : <Plus size={17} />} {showForm ? t("usr.cancel") : t("req.new")}
        </button>
      </div>

      {showForm && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.formType")}</label>
              <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((x) => <option key={x.v} value={x.v}>{x[lang]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.formDetail")}</label>
              <input style={inputStyle} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={lang === "fr" ? "Période, motif…" : "Period, reason…"} />
            </div>
          </div>
          <button onClick={add} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{t("req.add")}</button>
        </Card>
      )}

      <Card style={{ marginTop: 18, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("req.type")}</span><span>{t("req.formDetail")}</span><span>{t("req.date")}</span><span>{t("req.status")}</span>
        </div>
        {items.length === 0 ? <EmptyState title={t("req.empty")} /> : items.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr auto", gap: 12, alignItems: "center", padding: "15px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.type[lang]}</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.detail || "—"}</span>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{r.date}</span>
            <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
