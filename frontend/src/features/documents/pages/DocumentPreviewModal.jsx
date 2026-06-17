import { useState, useEffect } from "react";
import { X, Send, Clock } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";

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

  if (!preview) return null;
  const expired = left <= 0;
  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "88vh", background: "var(--surface)", borderRadius: 16, border: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t("docs.preview")}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.document_name}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: expired ? "var(--danger)" : "var(--gold-deep)", background: "var(--field)", borderRadius: 999, padding: "4px 10px" }}>
            <Clock size={13} /> {t("docs.expiresIn")} {mmss}
          </span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22, background: "#fff" }}>
          <div dangerouslySetInnerHTML={{ __html: preview.html_preview }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ height: 42, padding: "0 16px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("docs.cancel")}</button>
          <button onClick={onConfirm} disabled={busy || expired} style={{ height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, cursor: busy || expired ? "not-allowed" : "pointer", opacity: busy || expired ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            <Send size={16} /> {t("docs.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
