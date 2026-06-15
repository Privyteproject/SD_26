import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useAsync } from "../../../lib/useAsync";
import { getAbsences, createAbsence } from "../../../lib/api";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";

const tone = { pending: "warning", validated: "success", refused: "danger" };
const key = { pending: "st.pending", validated: "st.validated", refused: "st.refused" };

// Types d'absence reconnus par le backend (code_type ∈ ABSENCE_TYPE_CODES).
const TYPES = [
  { code: "CONGE", fr: "Congé payé", en: "Paid leave" },
  { code: "MALADIE", fr: "Arrêt maladie", en: "Sick leave" },
  { code: "TELETRAVAIL", fr: "Télétravail", en: "Remote work" },
  { code: "RTT", fr: "RTT", en: "RTT" },
];
const inputStyle = { height: 42, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" };

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function Requests() {
  const { t, lang } = useI18n();
  // GET /absences -> le backend filtre déjà sur l'utilisateur courant (collaborateur).
  const { data, loading, error, reload } = useAsync(() => getAbsences());
  const items = (data && data.data) || [];

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(TYPES[0].code);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setType(TYPES[0].code); setStart(""); setEnd(""); setReason(""); setErr(""); };

  const add = async () => {
    if (!start || !end) { setErr(t("usr.errRequired")); return; }
    if (end < start) { setErr(t("req.errDates")); return; }
    setSaving(true); setErr("");
    try {
      // POST /absences { type, start_date, end_date, reason }
      await createAbsence({ type, start_date: start, end_date: end, reason: reason || undefined });
      resetForm(); setShowForm(false); reload();
    } catch (e) {
      setErr((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("req.title")}</h1>
        <button onClick={() => { setShowForm(!showForm); setErr(""); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          {showForm ? <X size={17} /> : <Plus size={17} />} {showForm ? t("usr.cancel") : t("req.new")}
        </button>
      </div>

      {showForm && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.formType")}</label>
              <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((x) => <option key={x.code} value={x.code}>{x[lang]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.reason")}</label>
              <input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={lang === "fr" ? "Motif (optionnel)" : "Reason (optional)"} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.start")}</label>
              <input type="date" style={inputStyle} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("req.end")}</label>
              <input type="date" style={inputStyle} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
          <button onClick={add} disabled={saving} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>{saving ? t("common.loading") : t("req.add")}</button>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!items.length} emptyLabel={t("req.empty")}>
        <Card style={{ marginTop: 18, padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.4fr 1.2fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("req.type")}</span><span>{t("req.period")}</span><span>{t("req.reason")}</span><span>{t("req.status")}</span>
          </div>
          {items.map((r, i) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.4fr 1.2fr auto", gap: 12, alignItems: "center", padding: "15px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.type}</span>
              <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{fmt(r.start_date, lang)} – {fmt(r.end_date, lang)}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.reason || "—"}</span>
              <Badge tone={tone[r.status]}>{t(key[r.status])}</Badge>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
