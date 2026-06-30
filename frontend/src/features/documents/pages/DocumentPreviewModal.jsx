import { useState, useEffect } from "react";
import { X, Send, Clock, Download } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { getPreviewPdfUrl } from "../../../lib/api";

// Modal d'aperçu : affiche le HTML généré, un compte à rebours d'expiration du
// preview_token, et confirme la soumission.
export default function DocumentPreviewModal({ preview, onConfirm, onClose, busy }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!preview?.expires_at) return;
    const end = new Date(preview.expires_at).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [preview]);

  const expired = left <= 0;
  const m = Math.floor(left / 60);
  const s = left % 60;
  const mmss = `${m}:${s < 10 ? "0" : ""}${s}`;

  if (!preview) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", height: "100vh", maxWidth: 840, background: "var(--surface)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 20px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t("docs.preview")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.document_name}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: expired ? "var(--danger)" : "var(--gold-deep)", background: "var(--field)", borderRadius: 999, padding: "4px 10px" }}>
            <Clock size={13} /> {t("docs.expiresIn")} {mmss}
          </span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", background: "#f5f5f5", display: "flex", justifyContent: "center" }}>
          {preview.is_binary && preview.format === "pdf" ? (
            <iframe 
              src={getPreviewPdfUrl(preview.preview_token) + "#toolbar=0&navpanes=0&view=Fit"} 
              style={{ width: "100%", height: "100%", border: "none" }} 
              title="PDF Preview"
            />
          ) : (
            <iframe 
              srcDoc={preview.html_preview} 
              style={{ width: "100%", maxWidth: "21cm", height: "100%", border: "none", background: "white", boxShadow: "0 0 10px rgba(0,0,0,0.1)" }} 
              title="HTML Preview"
            />
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
          <button onClick={onClose} className="sd-btn sd-btn--outline">{t("docs.cancel")}</button>

          <button onClick={onConfirm} disabled={busy || expired} className="sd-btn sd-btn--gold">
            <Send size={16} /> {t("docs.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
