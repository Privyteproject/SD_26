import { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { importEmployeesCsv } from "../../../lib/api";

// Modal d'import CSV d'employés (RH/Admin). Envoie le fichier en multipart, affiche
// le bilan (créés / erreurs ligne par ligne).
export default function ImportModal({ onClose, onDone }) {
  const { t } = useI18n();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!file) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const res = await importEmployeesCsv(file);
      setResult((res && res.data) || {});
      onDone?.();
    } catch (e) {
      setErr((e && (e.payload?.detail || e.message)) || t("common.error"));
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--line)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t("imp.title")}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>{t("imp.hint")}</div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px dashed var(--line)", background: "var(--field)", cursor: "pointer" }}>
            <FileText size={18} style={{ color: "var(--gold-deep)" }} />
            <span style={{ flex: 1, fontSize: 13.5, color: file ? "var(--ink)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file ? file.name : t("imp.choose")}
            </span>
            <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} style={{ display: "none" }} />
          </label>

          {err && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{err}</div>}

          {result && (
            <div style={{ marginTop: 14, fontSize: 13.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #2e8c57)", fontWeight: 600 }}>
                <CheckCircle2 size={16} /> {result.created} {t("imp.created")}
              </div>
              {(result.errors || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--danger)", fontWeight: 600, marginBottom: 6 }}>
                    <AlertTriangle size={16} /> {result.errors.length} {t("imp.failed")}
                  </div>
                  <div style={{ maxHeight: 140, overflowY: "auto", fontSize: 12.5, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                    {result.errors.map((er, i) => <div key={i}>Ligne {er.line} : {er.error}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("imp.close")}</button>
          <button onClick={submit} disabled={busy || !file} style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy || !file ? "not-allowed" : "pointer", opacity: busy || !file ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            <Upload size={16} /> {busy ? t("common.loading") : t("imp.run")}
          </button>
        </div>
      </div>
    </div>
  );
}
