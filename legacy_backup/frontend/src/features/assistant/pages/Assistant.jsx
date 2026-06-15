import { Send, MessageSquare } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";

export default function Assistant() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px - 110px)" }}>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", margin: "0 0 14px" }}>
        {t("nav.assistant")}
      </h1>

      <div style={{
        flex: 1, border: "1px solid var(--line)", borderRadius: 16, background: "var(--surface)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", color: "var(--muted)", padding: 24,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <MessageSquare size={24} />
        </div>
        <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t("nav.assistant")}</div>
        <div style={{ fontSize: 13, marginTop: 6, maxWidth: 360 }}>{t("scaffold.soon")}</div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginTop: 14,
        border: "1px solid var(--line)", borderRadius: 12, background: "var(--field)", padding: "0 8px 0 14px", height: 52,
      }}>
        <input
          placeholder={t("header.search")}
          disabled
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 14, fontFamily: "inherit" }}
        />
        <button disabled style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: .7 }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
