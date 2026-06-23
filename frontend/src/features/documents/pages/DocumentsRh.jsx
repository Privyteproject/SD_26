import { useState, useRef, useEffect } from "react";
import { Check, X, Download, Plus, Trash2, Edit, Upload } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import ContextMenu from "../../../components/ContextMenu";
import { useAsync } from "../../../lib/useAsync";
import {
  getDocuments, getEmployees, updateDocumentStatus, downloadDocument,
  getDocumentModeles, createDocumentModele, deleteDocumentModele,
  uploadDocumentModeleFile, previewDocumentTemplate,
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

const VariableButton = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };
  return (
    <button
      onClick={handleCopy}
      title="Cliquer pour copier dans le presse-papiers"
      style={{
        background: "var(--field)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        cursor: "pointer",
        color: copied ? "var(--gold)" : "var(--ink)",
        fontFamily: "monospace",
        textAlign: "left",
        overflow: "hidden",
        textOverflow: "ellipsis",
        transition: "all 0.2s ease"
      }}
    >
      {copied ? "Copié !" : value}
    </button>
  );
};

// ── Workspace de Gestion du Template via Téléversement strictly ──
function TemplateEditor({ model, onClose, onSave }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewTrigger, setPreviewTrigger] = useState(0);
  
  const fileInputRef = useRef(null);

  // Charger la preview au chargement et lors de chaque téléversement
  useEffect(() => {
    const updatePreview = async () => {
      setPreviewHtml("");
      setPreviewError("");
      try {
        const res = await previewDocumentTemplate({ doc_type: model.code });
        if (res && res.data) {
          setPreviewHtml(res.data.html_preview);
        }
      } catch (e) {
        setPreviewError((e.payload && e.payload.detail) || e.message);
      }
    };
    updatePreview();
  }, [model.code, previewTrigger]);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg("");
    try {
      await uploadDocumentModeleFile(model.code, file);
      setPreviewTrigger((prev) => prev + 1);
      if (onSave) onSave();
      alert("Nouveau modèle importé et validé avec succès !");
    } catch (err) {
      setMsg((err.payload && err.payload.detail) || err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const iframeSrcMatch = previewHtml?.match(/src="([^"]+)"/);
  const iframeSrc = iframeSrcMatch ? iframeSrcMatch[1] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "80vh", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginTop: 20 }}>
      {/* Barre d'actions supérieure */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
            Gestionnaire de Modèle : <span style={{ color: "var(--gold)" }}>{model.libelle}</span> ({model.code})
          </h2>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Téléversez un nouveau template pour remplacer le modèle actuel</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
            Fermer
          </button>
        </div>
      </div>
      
      {msg && <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", padding: "10px 24px", fontSize: 13, borderBottom: "1px solid var(--danger)" }}>{msg}</div>}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar des variables */}
        <div style={{ width: "240px", borderRight: "1px solid var(--line)", padding: 16, overflowY: "auto", fontSize: 13, display: "flex", flexDirection: "column", gap: 18, background: "var(--surface)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginBottom: -8 }}>Cliquez sur une variable pour la copier.</div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 8, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>Collaborateur</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {["{{ employee.prenom }}", "{{ employee.nom }}", "{{ employee.poste }}", "{{ employee.department.nom }}", "{{ employee.date_entree }}"].map((v) => (
                <VariableButton key={v} value={v} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 8, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>Entreprise</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {["{{ company.nom }}", "{{ company.adresse }}"].map((v) => (
                <VariableButton key={v} value={v} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 8, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>Variables Globales</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {["{{ date_generation }}", "{{ label }}"].map((v) => (
                <VariableButton key={v} value={v} />
              ))}
            </div>
          </div>
        </div>

        {/* Zone centrale : Uploader */}
        <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", background: "var(--field)" }}>
          {/* Card: État actuel */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Modèle Actuel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Format :</span>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {model.is_binary ? `${model.format?.toUpperCase()} (Binaire)` : "HTML / Jinja2"}
                </span>
              </div>
              {model.is_binary && model.filename && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>Fichier :</span>
                  <span style={{ fontWeight: 500, color: "var(--gold-deep)", fontFamily: "monospace" }}>{model.filename}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Card: Téléversement de fichier */}
          <Card style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "2px dashed var(--line)", background: "var(--surface)", minHeight: 200, padding: 30, borderRadius: 12 }}>
            <Upload size={36} style={{ color: "var(--gold)", marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", textAlign: "center", marginBottom: 6 }}>
              Sélectionnez un nouveau template
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginBottom: 20 }}>
              Formats acceptés : .docx, .pdf
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              style={{
                height: 38,
                padding: "0 18px",
                borderRadius: 8,
                border: "none",
                background: "var(--gold)",
                color: "var(--on-gold)",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
                fontFamily: "inherit",
                fontSize: 13
              }}
            >
              {busy ? "Téléchargement..." : "Parcourir les fichiers"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".docx,.pdf"
              style={{ display: "none" }}
              onChange={handleUploadFile}
            />
          </Card>
        </div>

        {/* Zone de preview */}
        <div style={{ width: "40%", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", height: "100%", background: "var(--surface)" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Aperçu en Direct</span>
            {previewError && <span style={{ color: "var(--danger)", fontSize: 11 }}>Erreur de rendu</span>}
          </div>
          <div style={{ flex: 1, position: "relative", padding: iframeSrc ? "0" : "12px", overflow: "hidden" }}>
            {previewError ? (
              <div style={{ color: "var(--danger)", padding: 12, fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "monospace", background: "rgba(239, 68, 68, 0.1)", borderRadius: 6, border: "1px solid var(--danger)", height: "100%", overflowY: "auto" }}>
                {previewError}
              </div>
            ) : (
              iframeSrc ? (
                <iframe
                  title="live-preview"
                  src={iframeSrc}
                  style={{ width: "100%", height: "100%", border: "1px solid var(--line)", background: "#ffffff", borderRadius: 6 }}
                />
              ) : (
                <iframe
                  title="live-preview"
                  srcDoc={previewHtml}
                  style={{ width: "100%", height: "100%", border: "1px solid var(--line)", background: "#ffffff", borderRadius: 6 }}
                />
              )
            )}
          </div>
        </div>
      </div>
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingModel, setEditingModel] = useState(null);
  const [activeUploadCode, setActiveUploadCode] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadCode) return;
    setBusy(true); setMsg("");
    try {
      await uploadDocumentModeleFile(activeUploadCode.code, file);
      setMsg("");
      reload();
      alert("Modèle importé et validé avec succès !");
    } catch (err) {
      setMsg((err.payload && err.payload.detail) || err.message);
    } finally {
      setBusy(false);
      setActiveUploadCode(null);
      e.target.value = "";
    }
  };

  const triggerUpload = (model) => {
    setActiveUploadCode(model);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const add = async () => {
    if (!libelle.trim()) return;
    setBusy(true); setMsg("");
    try {
      await createDocumentModele({ libelle: libelle.trim(), categorie: categorie.trim() || null });
      setLibelle(""); setCategorie(""); reload();
    } catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };
  const remove = async (code) => {
    setBusy(true); setMsg("");
    try { await deleteDocumentModele(code); reload(); }
    catch (e) { setMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setBusy(false); }
  };

  if (editingModel) {
    return (
      <TemplateEditor
        model={editingModel}
        onClose={() => setEditingModel(null)}
        onSave={() => {
          reload();
        }}
      />
    );
  }

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
      </Card>

      <input
        type="file"
        ref={fileInputRef}
        accept=".docx,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!types.length} emptyLabel="—">
        <Card style={{ padding: 0 }}>
          {types.map((m, i) => (
            <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.libelle}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {m.code}{m.categorie ? ` · ${m.categorie}` : ""}
                  {m.is_binary && <span style={{ color: "var(--gold-deep)", fontWeight: 600, fontSize: 11, marginLeft: 8 }}>· {m.format?.toUpperCase()}</span>}
                </div>
              </div>
              {m.actif === false && <Badge tone="warning">{t("docs.inactive")}</Badge>}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => triggerUpload(m)} disabled={busy} title="Importer un fichier template (.docx, .pdf)" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Upload size={15} /></button>
                <button onClick={() => setEditingModel(m)} disabled={busy} title="Gérer le modèle de document" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit size={15} /></button>
                <button onClick={() => remove(m.code)} disabled={busy} title={t("common.delete") || "Supprimer"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}

