import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, FileText, ShieldCheck, Star, AlertCircle, Database, Zap } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { sendChatMessage, ApiError } from "../../../lib/api";

// Petit badge d'information (méta de la pipeline : périmètre, PII, cache, modèle…).
function MetaChip({ icon: Icon, children, tone = "muted" }) {
  const colors = {
    muted: { bg: "var(--field)", fg: "var(--muted)" },
    gold: { bg: "var(--gold-tint)", fg: "var(--gold-deep)" },
    ok: { bg: "rgba(46,140,87,.12)", fg: "#2e8c57" },
    warn: { bg: "rgba(180,120,20,.12)", fg: "#9a6b12" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
      background: colors.bg, color: colors.fg, borderRadius: 999, padding: "3px 9px" }}>
      {Icon && <Icon size={12} />} {children}
    </span>
  );
}

// Étiquette lisible du périmètre détecté par le classifieur.
const PERIMETRE_LABEL = {
  RH: "RH", CULTURE: "Culture générale", HORS_SUJET: "Hors sujet", DANGEREUX: "Bloqué",
};

function SourcesBlock({ sources }) {
  if (!sources || !sources.length) return null;
  return (
    <div style={{ marginTop: 10, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
        <FileText size={12} /> Sources RAG ({sources.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sources.map((s) => (
          <div key={s.id} style={{ fontSize: 12, color: "var(--ink)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>• {s.title}</span>
            <span style={{ color: "var(--muted)", flexShrink: 0 }}>score {s.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JudgeBlock({ judge }) {
  if (!judge) return null;
  const note = judge.note;
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
        background: "var(--gold-tint)", color: "var(--gold-deep)", borderRadius: 999, padding: "3px 9px" }}>
        <Star size={12} /> Juge : {note != null ? `${note}/5` : "n/a"}{judge.verdict ? ` · ${judge.verdict}` : ""}
      </span>
      {judge.justification && (
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>{judge.justification}</span>
      )}
    </div>
  );
}

// Pied de bulle assistant : badges méta + sources + juge.
function AssistantMeta({ meta, model, degraded, judge }) {
  const perim = meta?.perimetre;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {perim && <MetaChip tone={perim === "DANGEREUX" ? "warn" : "gold"}>{PERIMETRE_LABEL[perim] || perim}</MetaChip>}
        {model && <MetaChip icon={Zap}>{degraded ? "démo" : model}</MetaChip>}
        {meta?.pii_masked && <MetaChip icon={ShieldCheck} tone="ok">PII masquées</MetaChip>}
        {meta?.cache_hit && <MetaChip icon={Database}>cache</MetaChip>}
        {meta?.authorized === false && <MetaChip icon={AlertCircle} tone="warn">accès refusé</MetaChip>}
      </div>
      <SourcesBlock sources={meta?.sources} />
      <JudgeBlock judge={judge} />
    </div>
  );
}

export default function Assistant() {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]); // { role, content, meta?, model?, degraded?, judge?, error? }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text };
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await sendChatMessage(text, history, true); // judge=true : on affiche la note
      const d = (res && res.data) || {};
      setMessages((prev) => [...prev, {
        role: "assistant", content: d.reply || "(réponse vide)",
        meta: d.meta, model: d.model, degraded: d.degraded, judge: d.judge,
      }]);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 429
        ? "Trop de requêtes — patientez une minute avant de réessayer."
        : `Service IA indisponible${err?.message ? ` : ${err.message}` : ""}.`;
      setMessages((prev) => [...prev, { role: "assistant", content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const empty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px - 110px)" }}>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", margin: "0 0 14px" }}>
        {t("nav.assistant")}
      </h1>

      {/* Fil de conversation */}
      <div ref={scrollRef} style={{
        flex: 1, border: "1px solid var(--line)", borderRadius: 16, background: "var(--surface)",
        padding: 18, overflowY: "auto",
      }}>
        {empty ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MessageSquare size={24} />
            </div>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{t("nav.assistant")}</div>
            <div style={{ fontSize: 13, marginTop: 6, maxWidth: 420 }}>
              Posez une question RH (congés, télétravail, attestation, onboarding…). Les réponses
              s'appuient sur les documents internes autorisés et sont évaluées par un modèle juge.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%",
                    background: isUser ? "var(--gold)" : (m.error ? "rgba(180,64,46,.10)" : "var(--field)"),
                    color: isUser ? "var(--on-gold)" : (m.error ? "var(--danger)" : "var(--ink)"),
                    border: isUser ? "none" : "1px solid var(--line)",
                    borderRadius: 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
                  }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                    {!isUser && !m.error && <AssistantMeta meta={m.meta} model={m.model} degraded={m.degraded} judge={m.judge} />}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 14px", fontSize: 14, color: "var(--muted)" }}>
                  L'assistant réfléchit…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barre de saisie */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginTop: 14,
        border: "1px solid var(--line)", borderRadius: 12, background: "var(--field)", padding: "0 8px 0 14px", height: 52,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrivez votre question RH…"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 14, fontFamily: "inherit" }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1 }}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}
