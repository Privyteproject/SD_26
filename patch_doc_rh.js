const fs = require('fs');
const path = './frontend/src/features/documents/pages/DocumentsRh.jsx';
let content = fs.readFileSync(path, 'utf8');

const newImports = `import { useState, useRef } from "react";
import { Check, X, Download, Plus, Trash2, UploadCloud, Copy } from "lucide-react";`;
content = content.replace(/import \{ useState \} from "react";\nimport \{ Check, X, Download, Plus, Trash2 \} from "lucide-react";/, newImports);

const newApiImports = `import {
  getDocuments, getEmployees, updateDocumentStatus, downloadDocument,
  getDocumentModeles, createDocumentModele, deleteDocumentModele, uploadDocumentModeleFile
} from "../../../lib/api";`;
content = content.replace(/import \{\n  getDocuments, getEmployees, updateDocumentStatus, downloadDocument,\n  getDocumentModeles, createDocumentModele, deleteDocumentModele,\n\} from "\.\.\/\.\.\/\.\.\/lib\/api";/, newApiImports);


const newManager = `function DocTypesManager() {
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const copyVar = (v) => navigator.clipboard.writeText(v);

  const field = { height: 40, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", outline: "none", fontFamily: "inherit", fontSize: 13.5 };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("docs.types")}</div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--danger)" }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 14 }}>
        <Card style={{ margin: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center", marginBottom: 15 }}>
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder={t("docs.typeName")} style={field} />
            <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder={t("docs.category")} style={field} />
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
            <button onClick={add} disabled={busy || !libelle.trim() || !file} style={{ height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy || !libelle.trim() || !file ? "not-allowed" : "pointer", opacity: busy || !libelle.trim() || !file ? 0.6 : 1, display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}><Plus size={16} /> {t("docs.add")}</button>
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
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.code}{m.categorie ? \` · \${m.categorie}\` : ""} {m.is_binary ? \` · (\${m.format.toUpperCase()})\` : ""}</div>
              </div>
              {m.actif === false && <Badge tone="warning">{t("docs.inactive")}</Badge>}
              <button onClick={() => remove(m.code)} disabled={busy} title={t("common.delete") || "Supprimer"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
            </div>
          ))}
        </Card>
      </AsyncBoundary>
    </div>
  );
}`;

content = content.replace(/function DocTypesManager\(\) \{[\s\S]*\}\n$/, newManager + "\n");
fs.writeFileSync(path, content);
