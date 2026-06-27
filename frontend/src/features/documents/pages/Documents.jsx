import { useState } from "react";
import { Download, Plus, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMyDocuments, confirmDocument, downloadDocument } from "../../../lib/api";
import DocumentRequestForm from "./DocumentRequestForm";
import DocumentPreviewModal from "./DocumentPreviewModal";

// Libellés de type pour l'affichage du tableau (alignés sur le registre backend).
const TYPE_LABELS = {
  attestation_travail: "Attestation de travail", attestation_salaire: "Attestation de salaire",
  demande_conge: "Demande de congé", demande_remboursement: "Note de frais",
  lettre_recommandation: "Lettre de recommandation", fiche_onboarding: "Fiche d'intégration",
  compte_rendu_entretien: "Compte-rendu d'entretien",
};
// statut interne (BDD) -> ton du badge + clé i18n. (en_attente=pending…)
const statusTone = { validated: "success", pending: "warning", refused: "danger", draft: "info" };
const statusKey = { validated: "st.validated", pending: "st.pending", refused: "st.refused", draft: "st.draft" };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function Documents() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getMyDocuments();
    return (res && res.data) || [];
  });
  const docs = data || [];

  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const onConfirm = async () => {
    if (!preview) return;
    setBusy(true); setMsg("");
    try {
      await confirmDocument(preview.preview_token);
      setPreview(null); setShowForm(false); reload(); // "redirige" vers la liste mise à jour
    } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };

  const download = async (d) => {
    try { await downloadDocument(d.id); } 
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
  };

  const th = { padding: "12px 16px", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" };
  const td = { padding: "13px 16px", fontSize: 14, color: "var(--ink)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("docs.title")}</h1>
        <button onClick={() => setShowForm((v) => !v)} className="sd-btn sd-btn--gold">
          {showForm ? <X size={17} /> : <Plus size={17} />} {t("docs.newRequest")}
        </button>
      </div>

      {msg && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}

      {showForm && <DocumentRequestForm onPreview={(p) => setPreview(p)} />}

      {/* Tableau des documents de l'utilisateur */}
      <div style={{ marginTop: 22, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t("docs.history")}</div>
      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!docs.length} emptyLabel={t("docs.empty")}>
        <Card style={{ marginTop: 10, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={th}>{t("docs.type")}</th>
                <th style={th}>{t("docs.title")}</th>
                <th style={th}>{t("req.date")}</th>
                <th style={th}>{t("req.status")}</th>
                <th style={{ ...th, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => (
                <tr key={d.id} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <td style={td}>{TYPE_LABELS[d.type] || d.type || "—"}</td>
                  <td style={{ ...td, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom_fichier}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{fmt(d.date_creation, lang)}</td>
                  <td style={td}><Badge tone={statusTone[d.statut] || "info"}>{t(statusKey[d.statut] || "st.pending")}</Badge></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {d.statut === "validated" ? (
                      <button onClick={() => download(d)} title={t("docs.download")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Download size={16} /></button>
                    ) : <span style={{ color: "var(--muted)", fontSize: 13 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </AsyncBoundary>

      <DocumentPreviewModal preview={preview} onConfirm={onConfirm} onClose={() => setPreview(null)} busy={busy} />
    </div>
  );
}
