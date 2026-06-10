import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun, Moon, Send, MessageSquare, Paperclip,
  ThumbsUp, ThumbsDown, Copy, Menu, LogOut,
  Settings, LayoutDashboard, FileText, Calendar,
  Sparkles, Shield, X, Archive, User
} from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import { useSecurity } from "../../../auth/useSecurity";
import { useApi, API } from "../../../auth/useApi";
import { getColors } from "../../../theme";
import { Mark } from "../../../components/Mark";
import { Sidebar } from "../../../components/Sidebar";
import toast, { Toaster } from "react-hot-toast";

const SUGGESTIONS = [
  "Combien de jours de congé me restent-il ?",
  "Comment soumettre une note de frais ?",
  "Quelle est la politique de télétravail ?",
  "Je veux demander une attestation de travail",
  "Comment fonctionne l'entretien annuel ?",
  "Quels sont mes avantages sociaux ?",
];

const DEMO_REPLIES = {
  "congé":       "Vous disposez actuellement de **18 jours de congés payés** restants sur votre solde 2026. Pour poser des congés, rendez-vous dans la section *Mes documents*. Les demandes doivent être soumises au minimum 5 jours ouvrés à l'avance.",
  "télétravail": "La politique de télétravail vous permet d'effectuer jusqu'à **2 jours par semaine**, sous réserve de validation de votre manager. Un accord individuel doit être signé.",
  "attestation": "Je peux générer votre attestation de travail automatiquement. Elle sera disponible sous 24h après validation RH. Souhaitez-vous que je lance la génération maintenant ?",
  "entretien":   "L'entretien annuel doit être planifié **avant le 30 juin 2026**. Votre manager est responsable de l'initiation. Vous recevrez une convocation par email.",
  "paie":        "⚠️ Les informations relatives à la paie sont confidentielles et accessibles uniquement via votre espace personnel sécurisé. Je ne peux pas afficher ces données ici.",
  "default":     "Je comprends votre question. Pour vous apporter la meilleure réponse, je consulte les politiques RH en vigueur. Si votre question nécessite une intervention humaine, je vous redirigerai vers un référent RH disponible.",
};

function getDemoReply(text) {
  const l = text.toLowerCase();
  if (l.includes("congé") || l.includes("vacances")) return DEMO_REPLIES["congé"];
  if (l.includes("télétravail") || l.includes("teletravail")) return DEMO_REPLIES["télétravail"];
  if (l.includes("attestation")) return DEMO_REPLIES["attestation"];
  if (l.includes("entretien") || l.includes("annuel")) return DEMO_REPLIES["entretien"];
  if (l.includes("paie") || l.includes("salaire")) return DEMO_REPLIES["paie"];
  return DEMO_REPLIES["default"];
}

export default function AssistantIA({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [messages,       setMessages]       = useState([{
    role: "assistant",
    text: "Bonjour ! Je suis votre assistant RH Synapse. Je suis disponible 24h/24 pour répondre à vos questions RH. Comment puis-je vous aider ?",
    time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [showSuggestions,setShowSuggestions]= useState(true);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const navigate       = useNavigate();
  const { user, logout } = useAuth();
  const { sanitize, detectPromptInjection } = useSecurity();
  const api = useApi();
  const c   = getColors(dark_);

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Collaborateur";

  const isMobile = vw < 768;

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // Sécurité S4 — détection prompt injection
    if (detectPromptInjection(text)) {
      setMessages(prev => [...prev, {
        role: "assistant", isWarning: true, time: now(),
        text: "⚠️ Votre message a été bloqué : il contient des instructions suspectes. Cet événement a été journalisé et transmis à l'administrateur.",
      }]);
      setInput("");
      toast.error("Message bloqué — tentative d'injection détectée");
      return;
    }

    const clean = sanitize(text);
    setMessages(prev => [...prev, { role: "user", text: clean, time: now() }]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    // Appel API réel — fallback démo si backend absent
    const res = await api.post(API.CHAT, {
      message: clean,
      history: messages.slice(-6).map(m => ({ role: m.role, content: m.text })),
    });

    const reply = res.ok && res.data?.reply
      ? sanitize(res.data.reply)
      : getDemoReply(clean);

    setMessages(prev => [...prev, { role: "assistant", text: reply, time: now() }]);
    setLoading(false);
  };

  const renderText = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${c.ink};font-weight:600">$1</strong>`)
      .replace(/\*(.*?)\*/g,     `<em style="color:${c.muted}">$1</em>`);

  const chatHistory = [
    { label: "Politique télétravail",  time: "Hier" },
    { label: "Solde congés 2026",      time: "28/05" },
    { label: "Demande attestation",    time: "20/05" },
    { label: "Entretien annuel",       time: "12/05" },
  ];

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: c.bg, color: c.ink,
      fontFamily: "ui-sans-serif, system-ui, sans-serif", display: "flex", transition: "background .4s" }}>
      <Toaster position="top-right" />

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      {/* Sidebar custom avec historique */}
      <aside style={{
        width: 240, background: c.surface, borderRight: `1px solid ${c.line}`,
        display: "flex", flexDirection: "column",
        position: isMobile ? "fixed" : "sticky",
        top: 0, left: 0, height: "100vh", zIndex: 50, flexShrink: 0,
        transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-240px)") : "none",
        transition: "transform .3s cubic-bezier(.2,.7,.3,1)",
      }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", gap: 10 }}>
          <Mark size={28} c={c} />
          <span style={{ lineHeight: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: c.ink }}>Synapse</span>
            <span style={{ display: "block", fontSize: 8, letterSpacing: 3, color: c.goldDeep, fontWeight: 600, marginTop: 2 }}>ASSISTANT IA RH</span>
          </span>
        </div>

        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.gold,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: c.onGold, fontWeight: 700, fontSize: 14 }}>{user?.initials || "?"}</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>{user?.name || "—"}</div>
            <div style={{ fontSize: 11, color: c.muted }}>{roleLabel}</div>
          </div>
        </div>

        <div style={{ padding: "12px 18px 6px" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.muted, fontWeight: 600 }}>Historique</div>
        </div>
        <div style={{ flex: 1, padding: "4px 10px", overflowY: "auto" }}>
          {chatHistory.map((h, i) => (
            <button key={i} style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              background: i === 0 ? c.surfaceAlt : "transparent",
              color: c.muted, fontSize: 13, textAlign: "left", transition: "all .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = c.surfaceAlt; }}
              onMouseLeave={e => { if (i !== 0) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, color: i === 0 ? c.ink : c.muted }}>{h.label}</span>
              <span style={{ fontSize: 11, color: c.muted, flexShrink: 0, marginLeft: 6 }}>{h.time}</span>
            </button>
          ))}
        </div>

        <nav style={{ padding: "8px 0", borderTop: `1px solid ${c.line}` }}>
          {[
            { icon: <LayoutDashboard size={18} />, label: "Tableau de bord", path: "/dashboard" },
            { icon: <MessageSquare size={18} />,   label: "Assistant IA",   path: "/assistant", active: true },
            { icon: <FileText size={18} />,        label: "Mes documents",  path: "/documents" },
            { icon: <Calendar size={18} />,        label: "Onboarding",     path: "/onboarding" },
            { icon: <Settings size={18} />,        label: "Paramètres",     path: "/profil" },
          ].map((item, i) => (
            <button key={i} onClick={() => navigate(item.path)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 18px", background: item.active ? c.surfaceAlt : "transparent",
              border: "none", cursor: "pointer", color: item.active ? c.gold : c.muted,
              fontSize: 13, fontWeight: item.active ? 600 : 400,
              borderLeft: item.active ? `3px solid ${c.gold}` : "3px solid transparent",
              transition: "all .2s", textAlign: "left",
            }}>{item.icon}<span>{item.label}</span></button>
          ))}
        </nav>

        <button onClick={() => { logout(); navigate("/"); }}
          style={{ margin: "8px 18px 18px", display: "flex", alignItems: "center", gap: 8,
            background: "transparent", border: `1px solid ${c.line}`, borderRadius: 8,
            color: c.muted, padding: "9px 12px", cursor: "pointer", fontSize: 13 }}>
          <LogOut size={16} /> Déconnexion
        </button>
      </aside>

      {/* Zone chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 58, background: c.surface, borderBottom: `1px solid ${c.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: c.ink, display: "flex" }}><Menu size={22} /></button>}
            <div style={{ width: 34, height: 34, borderRadius: "50%",
              background: `linear-gradient(135deg, ${c.gold}, ${c.goldDeep})`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} color={c.onGold} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>Assistant IA RH Synapse</div>
              <div style={{ fontSize: 11, color: c.successText, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.successText, display: "inline-block" }} />
                En ligne · Données RH sécurisées
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6,
              background: c.badge, borderRadius: 7, padding: "5px 10px" }}>
              <Shield size={13} color={c.gold} />
              <span style={{ fontSize: 12, color: c.badgeText, fontWeight: 500 }}>{roleLabel}</span>
            </div>
            <button onClick={() => setDark(!dark_)}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${c.line}`,
                background: c.surface, color: c.ink, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark_ ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : "20px 24px",
          display: "flex", flexDirection: "column", gap: 16 }}>

          {showSuggestions && messages.length === 1 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: c.muted, marginBottom: 10, textAlign: "center" }}>Suggestions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    background: c.surface, border: `1px solid ${c.line}`,
                    borderRadius: 20, padding: "7px 14px", cursor: "pointer",
                    fontSize: 12.5, color: c.ink, transition: "all .2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.color = c.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.line; e.currentTarget.style.color = c.ink; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              gap: 10, alignItems: "flex-end" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: msg.role === "user"
                  ? c.gold
                  : msg.isWarning
                    ? c.warn
                    : `linear-gradient(135deg, ${c.goldDeep}, ${c.gold})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {msg.role === "user"
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: c.onGold }}>{user?.initials || "?"}</span>
                  : <Sparkles size={14} color={c.onGold} />}
              </div>

              <div style={{ maxWidth: isMobile ? "82%" : "70%",
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{
                  background: msg.role === "user" ? c.badge : msg.isWarning ? c.warn : c.surface,
                  border: `1px solid ${msg.role === "user" ? c.gold : msg.isWarning ? c.warnText : c.line}`,
                  borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  padding: "12px 16px", fontSize: 13.5, lineHeight: 1.6, color: c.ink,
                  boxShadow: c.shadowCard,
                }} dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: c.muted }}>{msg.time}</span>
                  {msg.role === "assistant" && !msg.isWarning && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { icon: <Copy size={13} />,      action: () => { window.navigator?.clipboard?.writeText(msg.text); toast.success("Copié !"); } },
                        { icon: <ThumbsUp size={13} />,  action: () => toast.success("Merci pour votre retour !") },
                        { icon: <ThumbsDown size={13} />,action: () => toast("Retour transmis à l'équipe RH") },
                      ].map((btn, j) => (
                        <button key={j} onClick={btn.action}
                          style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, padding: 2, display: "flex" }}>
                          {btn.icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%",
                background: `linear-gradient(135deg, ${c.goldDeep}, ${c.gold})`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={14} color={c.onGold} />
              </div>
              <div style={{ background: c.surface, border: `1px solid ${c.line}`,
                borderRadius: "4px 16px 16px 16px", padding: "14px 18px", boxShadow: c.shadowCard }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: c.gold,
                      animation: "bounce 1.2s ease infinite", animationDelay: `${j*0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Disclaimer */}
        <div style={{ background: c.surface, borderTop: `1px solid ${c.line}`, padding: "6px 24px 0" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center",
            gap: 6, fontSize: 11, color: c.muted, paddingBottom: 4 }}>
            <Shield size={11} color={c.gold} />
            Réponses générées depuis les politiques RH validées. Données sensibles protégées. Supervisé par l'équipe RH.
          </div>
        </div>

        {/* Input */}
        <div style={{ background: c.surface, borderTop: `1px solid ${c.line}`,
          padding: isMobile ? "12px 12px 16px" : "14px 24px 20px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10,
              background: c.field, border: `1.5px solid ${c.line}`,
              borderRadius: 14, padding: "10px 12px", boxShadow: c.shadowCard }}>
              <textarea ref={inputRef} rows={1} value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Posez votre question RH…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: 14, color: c.ink, lineHeight: 1.5,
                  fontFamily: "inherit", minHeight: 22, maxHeight: 120, overflowY: "auto" }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex", padding: 4 }}>
                  <Paperclip size={18} />
                </button>
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                  style={{ width: 36, height: 36, borderRadius: 9,
                    background: input.trim() && !loading ? c.gold : c.line,
                    border: "none", cursor: input.trim() && !loading ? "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
                  <Send size={16} color={input.trim() && !loading ? c.onGold : c.muted} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 6, textAlign: "center" }}>
              Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
