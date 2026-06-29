import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, X, Send, Maximize2 } from "lucide-react";
import { useSession } from "../app/providers/SessionProvider";
import { useI18n } from "../app/providers/I18nProvider";
import { RH_SPACE_ROLES } from "../lib/constants";
import { sendChatMessage } from "../lib/api";

// Raccourci flottant + mini-chat pop-up vers l'assistant IA, présent sur toutes les pages.
export default function FloatingAssistant() {
  const { role } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const isRh = [...RH_SPACE_ROLES].includes(role);
  const audience = isRh ? "rh" : "collaborateur";
  const fullRoute = isRh ? "/rh/assistant" : "/app/assistant";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMessages((p) => [...p, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await sendChatMessage(text, { history, sessionId: null, audience });
      const d = (res && res.data) || {};
      setMessages((p) => [...p, { role: "assistant", content: d.reply || "(réponse vide)" }]);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: t("common.error"), error: true }]);
    } finally { setLoading(false); }
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  // Sur la page complète de l'assistant, on masque la bulle (évite deux interfaces IA).
  if (pathname === fullRoute || pathname.endsWith("/assistant")) return null;

  return (
    <>
      {/* Panneau mini-chat */}
      {open && (
        <div style={{ position: "fixed", right: 22, bottom: 92, zIndex: 60, width: 340, maxWidth: "calc(100vw - 32px)",
          height: 440, maxHeight: "calc(100vh - 140px)", display: "flex", flexDirection: "column",
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 16px 44px rgba(0,0,0,.28)", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--line)", background: "var(--gold-tint)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Bot size={17} /></span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("fab.title")}</span>
            <button onClick={() => navigate(fullRoute)} title={t("fab.openFull")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold-deep)", display: "flex", padding: 4 }}><Maximize2 size={16} /></button>
            <button onClick={() => setOpen(false)} title={t("docs.cancel")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 4 }}><X size={17} /></button>
          </div>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 12 }}>{t("fab.welcome")}</div>
            )}
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", background: isUser ? "var(--gold)" : (m.error ? "rgba(180,64,46,.1)" : "var(--field)"),
                    color: isUser ? "var(--on-gold)" : (m.error ? "var(--danger)" : "var(--ink)"), border: isUser ? "none" : "1px solid var(--line)",
                    borderRadius: 12, padding: "8px 11px", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              );
            })}
            {loading && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("common.loading")}</div>}
          </div>
          {/* Input */}
          <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--line)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder={t("fab.placeholder")}
              aria-label={t("fab.placeholder")}
              style={{ flex: 1, height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
            <button onClick={send} aria-label={t("fab.send") || "Envoyer"} disabled={loading || !input.trim()} style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !input.trim() ? 0.6 : 1 }}><Send size={16} /></button>
          </div>
        </div>
      )}

      {/* Pastille flottante */}
      <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60, display: "flex", alignItems: "center", gap: 10 }}>
        {hover && !open && (
          <span style={{ background: "var(--ink)", color: "var(--bg)", fontSize: 12.5, fontWeight: 600, padding: "7px 11px", borderRadius: 9, whiteSpace: "nowrap", boxShadow: "var(--shadow)" }}>{t("fab.ask")}</span>
        )}
        <button
          aria-label={t("fab.ask")}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{
            width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "var(--grad-gold)", color: "var(--on-gold)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: hover ? "0 14px 28px -10px rgba(169,119,47,.6)" : "0 8px 20px -10px rgba(169,119,47,.5)",
            transform: hover ? "translateY(-2px)" : "none", transition: "transform .18s ease, box-shadow .18s ease",
          }}
        >
          {open ? <X size={22} /> : <Bot size={24} />}
        </button>
      </div>
    </>
  );
}
