import { useState } from "react";
import { Check, X, Download, Plus, Trash2 } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import ContextMenu from "../../../components/ContextMenu";
import { useAsync } from "../../../lib/useAsync";
import {
  getDocuments, getEmployees, updateDocumentStatus, downloadDocument,
  getDocumentModeles, createDocumentModele, deleteDocumentModele,
} from "../../../lib/api";

const tone = { validated: "success", pending: "warning", refused: "danger", draft: "info" };
const skey = { validated: "st.validated", pending: "st.pending", refused: "st.refused", draft: "st.draft" };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

// Validation RH des documents (PATCH /documents/{id}/status) + gestion des types.
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
  // On n'affiche que les documents SOUMIS (les brouillons restent privés à l'auteur).
  const docs = [...(data?.docs || [])]
    .filter((d) => d.statut !== "draft")
    .sort((a, b) => (b.statut === "pending") - (a.statut === "pending"));

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
                <ContextMenu actions={[
                  { label: t("reqr.approve"), icon: Check, onClick: () => act(d.id, "validated"), disabled: busy || d.statut === "validated" },
                  { label: t("reqr.refuse"), icon: X, onClick: () => act(d.id, "refused"), danger: true, disabled: busy || d.statut === "refused" },
                  { label: t("docs.download"), icon: Download, onClick: () => dl(d.id) },
                ]} />
              </div>
            );
          })}
        </Card>
      </AsyncBoundary>

      <DocTypesManager />
    </div>
  );
}

// ── Gestion des types de documents (RH/Direction) : CRUD des modèles ──
function DocTypesManager() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getDocumentModeles({ all: true });
    return (res && res.data) || [];
  });
  const types = data || [];
  const [libelle, setLibelle] = useState("");
  const [categorie, setCategorie] = useState("");
  const [gabarit, setGabarit] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const add = async () => {
    if (!libelle.trim()) return;
    setBusy(true); setMsg("");
    try {
      await createDocumentModele({ libelle: libelle.trim(), categorie: categorie.trim() || null, gabarit: gabarit.trim() || null });
      setLibelle(""); setCategorie(""); setGabarit(""); reload();
    } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };
  const remove = async (code) => {
    setBusy(true); setMsg("");
    try { await deleteDocumentModele(code); reload(); }
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };

  const field = { height: 40, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 13.5 };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("docs.types")}</div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr auto", gap: 10, alignItems: "center" }}>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder={t("docs.typeName")} style={field} />
          <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder={t("docs.category")} style={field} />
          <button onClick={add} disabled={busy || !libelle.trim()} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy || !libelle.trim() ? "not-allowed" : "pointer", opacity: busy || !libelle.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}><Plus size={16} /> {t("docs.add")}</button>
        </div>
        <textarea value={gabarit} onChange={(e) => setGabarit(e.target.value)} placeholder={t("docs.template")} rows={3}
          style={{ ...field, height: "auto", width: "100%", marginTop: 10, padding: 10, lineHeight: 1.5, resize: "vertical", boxSizing: "border-box" }} />
      </Card>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!types.length} emptyLabel="—">
        <Card style={{ padding: 0 }}>
          {types.map((m, i) => (
            <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.libelle}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.code}{m.categorie ? ` · ${m.categorie}` : ""}</div>
              </div>
              {m.actif === false && <Badge tone="warning">{t("docs.inactive")}</Badge>}
              <button onClick={() => remove(m.code)} disabled={busy} title={t("common.delete") || "Supprimer"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
