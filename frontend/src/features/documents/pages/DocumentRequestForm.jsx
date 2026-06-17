import { useState, useEffect } from "react";
import { Eye, ShieldAlert } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDocumentTypes, previewDocument } from "../../../lib/api";

// Champs rendus en zone de texte (le reste = input simple). Date/booléen/nombre déduits du nom.
const TEXTAREA = new Set(["commentaire", "justificatif_note", "competences_a_mettre_en_avant",
  "objectifs_30j", "formations_prevues", "points_forts", "axes_amelioration", "objectifs_annee_suivante"]);
const LABELS = {
  objet: "Objet", include_primes: "Inclure les primes", date_debut: "Date de début",
  date_fin: "Date de fin", type_conge: "Type de congé", motif: "Motif", commentaire: "Commentaire",
  date_depense: "Date de la dépense", montant: "Montant", nature_depense: "Nature de la dépense",
  justificatif_note: "Justificatif", destinataire: "Destinataire", objet_recommandation: "Objet de la recommandation",
  competences_a_mettre_en_avant: "Compétences à mettre en avant", manager_nom: "Nom du manager",
  poste: "Poste", objectifs_30j: "Objectifs 30 jours", formations_prevues: "Formations prévues",
  date_entretien: "Date de l'entretien", evaluateur_nom: "Évaluateur", periode_evaluee: "Période évaluée",
  points_forts: "Points forts", axes_amelioration: "Axes d'amélioration",
  objectifs_annee_suivante: "Objectifs année suivante",
};
const labelOf = (k) => LABELS[k] || k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const inputType = (k) => k.includes("date") ? "date" : k.startsWith("include_") ? "boolean" : k === "montant" ? "number" : (TEXTAREA.has(k) ? "textarea" : "text");

export default function DocumentRequestForm({ onPreview }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getDocumentTypes();
    return (res && res.data) || [];
  });
  const types = data || [];

  const [typeKey, setTypeKey] = useState("");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (types.length && !types.some((x) => x.key === typeKey)) { setTypeKey(types[0].key); setValues({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const current = types.find((x) => x.key === typeKey);
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const renderField = (k, required) => {
    const tp = inputType(k);
    const field = { width: "100%", height: 44, marginTop: 6, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" };
    return (
      <div key={k} style={{ marginTop: 14, opacity: required ? 1 : 0.85 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: required ? "var(--ink)" : "var(--muted)" }}>
          {labelOf(k)} {required ? <span style={{ color: "var(--danger)" }}>*</span> : <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optionnel)</span>}
        </label>
        {tp === "boolean" ? (
          <div style={{ marginTop: 6 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!values[k]} onChange={(e) => set(k, e.target.checked)} /> {labelOf(k)}
            </label>
          </div>
        ) : tp === "textarea" ? (
          <textarea value={values[k] || ""} onChange={(e) => set(k, e.target.value)} rows={3}
            style={{ ...field, height: "auto", padding: 12, lineHeight: 1.5, resize: "vertical" }} />
        ) : (
          <input type={tp} value={values[k] || ""} onChange={(e) => set(k, e.target.value)} style={field} />
        )}
      </div>
    );
  };

  const submit = async () => {
    if (!current) return;
    // Vérifie les champs requis.
    const missing = (current.required_fields || []).filter((k) => !values[k] && inputType(k) !== "boolean");
    if (missing.length) { setMsg(`Champs obligatoires manquants : ${missing.map(labelOf).join(", ")}`); return; }
    setBusy(true); setMsg("");
    try {
      const additional_data = {};
      for (const k of [...(current.required_fields || []), ...(current.optional_fields || [])]) {
        if (values[k] !== undefined && values[k] !== "") additional_data[k] = values[k];
      }
      const res = await previewDocument({ type: typeKey, additional_data });
      onPreview((res && res.data) || null);
    } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };

  const field = { width: "100%", height: 44, marginTop: 6, borderRadius: 10, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" };

  return (
    <Card style={{ marginTop: 12 }}>
      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!types.length} emptyLabel="—">
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("docs.type")}</label>
        <select value={typeKey} onChange={(e) => { setTypeKey(e.target.value); setValues({}); setMsg(""); }} style={field}>
          {types.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        {current?.description && <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)" }}>{current.description}</div>}

        {current?.requires_rh_validation && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9a6b12", background: "rgba(180,120,20,.12)", borderRadius: 9, padding: "9px 12px" }}>
            <ShieldAlert size={16} /> Ce document nécessite une validation RH.
          </div>
        )}

        {(current?.required_fields || []).map((k) => renderField(k, true))}
        {(current?.optional_fields || []).map((k) => renderField(k, false))}

        {msg && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}
        <button onClick={submit} disabled={busy} style={{ marginTop: 18, height: 46, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
          <Eye size={18} /> {busy ? t("common.loading") : t("docs.previewBtn")}
        </button>
      </AsyncBoundary>
    </Card>
  );
}
