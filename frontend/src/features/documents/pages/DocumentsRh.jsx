import { useState } from "react";
import { Check, X, Download } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDocuments, getEmployees, updateDocumentStatus, downloadDocument } from "../../../lib/api";

const tone = { validated: "success", pending: "warning", refused: "danger", draft: "info" };
const skey = { validated: "st.validated", pending: "st.pending", refused: "st.refused", draft: "st.draft" };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

// Validation RH des documents : approuver / refuser (PATCH /documents/{id}/status).
export default function DocumentsRh() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const [docs, emps] = await Promise.all([getDocuments(), getEmployees()]);
    return { docs: (docs && docs.data) || [], employees: (emps && emps.data) || [] };
  });

  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");

  const nameById = {};
  for (const e of (data?.employees || [])) {
    nameById[e.id] = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || e.id;
  }
  const docs = [...(data?.docs || [])].sort((a, b) => (b.statut === "pending") - (a.statut === "pending"));

  const act = async (id, statut) => {
    setBusyId(id); setMsg("");
    try { await updateDocumentStatus(id, statut); reload(); }
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusyId(null); }
  };
  const dl = async (id) => {
    try { await downloadDocument(id); } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("docsr.title")}</h1>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!docs.length} emptyLabel={t("docsr.empty")}>
        <Card style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 1fr 1fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("reqr.requester")}</span><span>{t("docs.title")}</span><span>{t("req.date")}</span><span>{t("req.status")}</span><span></span>
          </div>
          {docs.map((d, i) => {
            const busy = busyId === d.id;
            return (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 1fr 1fr auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", opacity: busy ? 0.5 : 1 }}>
                <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{nameById[d.employee_id] || d.employee_id}</span>
                <span style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nom_fichier}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{fmt(d.date_creation, lang)}</span>
                <Badge tone={tone[d.statut] || "info"}>{t(skey[d.statut] || "st.pending")}</Badge>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => act(d.id, "validated")} disabled={busy || d.statut === "validated"} title={t("reqr.approve")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: d.statut === "validated" ? "var(--line)" : "var(--success)", cursor: busy || d.statut === "validated" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} /></button>
                  <button onClick={() => act(d.id, "refused")} disabled={busy || d.statut === "refused"} title={t("reqr.refuse")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: d.statut === "refused" ? "var(--line)" : "var(--danger)", cursor: busy || d.statut === "refused" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
                  <button onClick={() => dl(d.id)} title={t("docs.download")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Download size={15} /></button>
                </span>
              </div>
            );
          })}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
