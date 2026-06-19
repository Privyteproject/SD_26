import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, ShieldCheck, AlertCircle, Database, Zap, Plus, Trash2, LifeBuoy } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useChat } from "../useChat";

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

const PERIMETRE_LABEL = { RH: "RH", CULTURE: "Culture générale", HORS_SUJET: "Hors sujet", DANGEREUX: "Bloqué" };
const RTL_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿֐-׿]/;
const isRtl = (text) => RTL_RE.test(text || "");

function timeAgo(iso, lang) {
  if (!iso) return "";
  const fr = lang === "fr";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return fr ? "à l'instant" : "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return fr ? `il y a ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return fr ? "hier" : "yesterday";
  return new Date(iso).toLocaleDateString(fr ? "fr-FR" : "en-GB");
}

function AssistantMeta({ meta, model, degraded }) {
  const perim = meta?.perimetre;
  if (!perim && !model && !meta?.pii_masked && !meta?.cache_hit && meta?.authorized !== false) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {perim && <MetaChip tone={perim === "DANGEREUX" ? "warn" : "gold"}>{PERIMETRE_LABEL[perim] || perim}</MetaChip>}
      {model && <MetaChip icon={Zap}>{degraded ? "démo" : model}</MetaChip>}
      {meta?.pii_masked && <MetaChip icon={ShieldCheck} tone="ok">PII masquées</MetaChip>}
      {meta?.cache_hit && <MetaChip icon={Database}>cache</MetaChip>}
      {meta?.authorized === false && <MetaChip icon={AlertCircle} tone="warn">accès refusé</MetaChip>}
    </div>
  );
}

export default function Assistant({ audience = "collaborateur" }) {
  const { t, lang } = useI18n();
  const { sessions, sessionsLoading, activeSessionId, messages, isLoading,
          sendMessage, newSession, deleteSession, openSession } = useChat(audience);
  const [input, setInput] = useState("");
  const [hoverId, setHoverId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const submit = () => { const text = input.trim(); if (!text || isLoading) return; setInput(""); sendMessage(text); };
  const onKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
  const empty = messages.length === 0;
  const title = audience === "rh" ? t("nav.assistantRh") : t("nav.assistant");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px - 110px)" }}>
      <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", margin: "0 0 14px" }}>{title}</h1>

      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
        {/* Colonne gauche : historique */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", padding: 12, minHeight: 0 }}>
          <button onClick={newSession} style={{ height: 40, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit", flexShrink: 0 }}>
            <Plus size={16} /> {t("chat.new")}
          </button>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, margin: "14px 4px 8px" }}>{t("chat.conversations")}</div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {sessionsLoading ? (
              [0, 1, 2, 3].map((i) => <div key={i} style={{ height: 40, borderRadius: 9, background: "var(--field)", opacity: 0.5 - i * 0.08 }} />)
            ) : sessions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 4px" }}>{t("chat.noConv")}</div>
            ) : sessions.map((s) => {
              const active = s.id === activeSessionId;
              return (
                <div key={s.id} onClick={() => openSession(s.id)} onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 9, cursor: "pointer", background: active ? "var(--gold-tint)" : "transparent" }}>
                  <MessageSquare size={14} style={{ color: "var(--gold-deep)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{timeAgo(s.updated_at, lang)}</span>
                  </span>
                  {hoverId === s.id && (
                    <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} title={t("chat.delete")} style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", padding: 2, display: "flex" }}><Trash2 size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Colonne droite : thread */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 16, background: "var(--surface)", padding: 18, overflowY: "auto", minHeight: 0 }}>
            {empty ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--muted)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <MessageSquare size={24} />
                </div>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</div>
                <div style={{ fontSize: 13, marginTop: 6, maxWidth: 440 }}>
                  {audience === "rh"
                    ? "Analysez les demandes, suivez les collaborateurs, consultez les indicateurs RH et préparez des réponses. L'assistant propose, vous validez."
                    : "Posez une question RH (congés, télétravail, attestation, onboarding…) ou une question d'ordre général."}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const escalade = !isUser && m.meta?.escalade;
                  const bg = isUser ? "var(--gold)" : escalade ? "rgba(180,120,20,.12)" : (m.error ? "rgba(180,64,46,.10)" : "var(--field)");
                  const border = isUser ? "none" : escalade ? "1px solid #9a6b12" : "1px solid var(--line)";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "80%", background: bg, color: isUser ? "var(--on-gold)" : (m.error ? "var(--danger)" : "var(--ink)"), border, borderRadius: 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.5 }}>
                        {escalade && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "#9a6b12", marginBottom: 6 }}>
                            <LifeBuoy size={15} /> {t("esc.title")}
                          </div>
                        )}
                        <div dir={isRtl(m.content) ? "rtl" : "ltr"} style={{ whiteSpace: "pre-wrap", textAlign: isRtl(m.content) ? "right" : "left" }}>{m.content}</div>
                        {!isUser && !m.error && !escalade && <AssistantMeta meta={m.meta} model={m.model} degraded={m.degraded} />}
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ background: "var(--field)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 14px", fontSize: 14, color: "var(--muted)" }}>L'assistant réfléchit…</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, border: "1px solid var(--line)", borderRadius: 12, background: "var(--field)", padding: "0 8px 0 14px", height: 52, flexShrink: 0 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Écrivez votre question…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: 14, fontFamily: "inherit" }} />
            <button onClick={submit} disabled={isLoading || !input.trim()}
              style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", cursor: isLoading || !input.trim() ? "not-allowed" : "pointer", opacity: isLoading || !input.trim() ? 0.6 : 1 }}>
              <Send size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
