import { useState, useRef } from "react";
import { Check, X, Download, Plus, Trash2, UploadCloud, Copy } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import ContextMenu from "../../../components/ContextMenu";
import { useAsync } from "../../../lib/useAsync";
import {
  getDocuments, getEmployees, updateDocumentStatus, downloadDocument,
  getDocumentModeles, createDocumentModele, deleteDocumentModele, uploadDocumentModeleFile
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
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef(null);

  const add = async () => {
    if (!libelle.trim() || !file) return;
    setBusy(true); setMsg("");
    try {
      const res = await createDocumentModele({ libelle: libelle.trim(), categorie: categorie.trim() || null });
      if (file) {
        await uploadDocumentModeleFile(res.data.code, file);
      }
      setLibelle(""); setCategorie(""); setFile(null); reload();
    } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };
  const remove = async (code) => {
    setBusy(true); setMsg("");
    try { await deleteDocumentModele(code); reload(); }
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };
  const handleUploadFile = async (code, e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const uploadFile = e.target.files[0];
    setBusy(true); setMsg("");
    try {
      await uploadDocumentModeleFile(code, uploadFile);
      reload();
    } catch (err) {
      setMsg((err && (err.payload?.detail || err.message)) || t("common.error"));
    } finally {
      setBusy(false);
      e.target.value = ""; // Réinitialise l'input
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const copyVar = (v) => navigator.clipboard.writeText(v);

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("docs.types")}</div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 14 }}>
        <Card style={{ margin: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center", marginBottom: 15 }}>
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder={t("docs.typeName")} className="sd-field" />
            <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder={t("docs.category")} className="sd-field" />
          </div>
          
          <div 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: "2px dashed var(--line)", borderRadius: 12, padding: 30, textAlign: "center", cursor: "pointer", background: "var(--field)", transition: "all 0.2s" }}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".docx,.pdf" style={{ display: "none" }} />
            <UploadCloud size={32} color="var(--muted)" style={{ margin: "0 auto 10px" }} />
            {file ? (
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{file.name}</div>
            ) : (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Glissez un modèle .docx ou .pdf ici</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>ou cliquez pour parcourir</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 15 }}>
            <button onClick={add} disabled={busy || !libelle.trim() || !file} className="sd-btn sd-btn--gold"><Plus size={16} /> {t("docs.add")}</button>
          </div>
        </Card>

        <Card style={{ margin: 0, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Variables Autorisées</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Cliquez pour copier et coller dans votre modèle (Jinja ou nom de champ PDF).</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["{{ employee.nom_complet }}", "{{ employee.poste }}", "{{ employee.matricule }}", "{{ date_generation }}"].map(v => (
              <div key={v} onClick={() => copyVar(v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--field)", borderRadius: 6, cursor: "pointer", fontSize: 12.5, fontFamily: "monospace", color: "var(--ink)" }}>
                {v} <Copy size={13} color="var(--muted)" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!types.length} emptyLabel="—">
        <Card style={{ padding: 0 }}>
          {types.map((m, i) => (
            <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.libelle}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.code}{m.categorie ? ` · ${m.categorie}` : ""} {m.is_binary ? ` · (${m.format.toUpperCase()})` : ""}</div>
              </div>
              {m.actif === false && <Badge tone="warning">{t("docs.inactive")}</Badge>}
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  onClick={() => document.getElementById(`upload-template-${m.code}`).click()} 
                  disabled={busy} 
                  title="Modifier le modèle (Upload)" 
                  style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <UploadCloud size={15} />
                </button>
                <input 
                  id={`upload-template-${m.code}`} 
                  type="file" 
                  onChange={(e) => handleUploadFile(m.code, e)} 
                  accept=".docx,.pdf" 
                  style={{ display: "none" }} 
                />
                <button onClick={() => remove(m.code)} disabled={busy} title={t("common.delete") || "Supprimer"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
