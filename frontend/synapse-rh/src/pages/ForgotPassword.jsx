import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Sun, Moon, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useApi, API } from "../auth/useApi";
import { useSecurity } from "../auth/useSecurity";
import { Mark } from "../components/Mark";
import { getColors } from "../theme";

export default function ForgotPassword({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate  = useNavigate();
  const api       = useApi();
  const { validators, sanitize } = useSecurity();
  const c = getColors(dark_);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw < 480;

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validators.email(email);
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    const res = await api.post("/api/auth/forgot-password", { email: sanitize(email) });
    setLoading(false);
    // Toujours afficher le succès (sécurité : ne pas révéler si l'email existe)
    setSent(true);
  }

  const fr = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 14px", height: 48,
    background: c.field,
    border: `1.5px solid ${error ? c.dangerText : c.line}`,
    borderRadius: 11,
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16,
      position: "relative", background: c.bg, color: c.ink,
      padding: isMobile ? 16 : 24,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      transition: "background .4s",
    }}>
      {/* Fond décoratif */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${c.glow || "rgba(184,137,62,.16)"}, transparent 65%)`,
        backgroundSize: "700px 700px", backgroundPosition: "center -100px", backgroundRepeat: "no-repeat",
      }} />

      <button onClick={() => setDark(!dark_)} style={{
        position: "absolute", top: isMobile ? 14 : 24, right: isMobile ? 14 : 24,
        width: 38, height: 38, borderRadius: 9,
        border: `1px solid ${c.line}`, background: c.surface,
        color: c.ink, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {dark_ ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div style={{
        background: c.surface, border: `1px solid ${c.line}`,
        borderRadius: 22, padding: isMobile ? 24 : 36,
        width: "100%", maxWidth: 420,
        boxShadow: c.shadow,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Mark size={32} c={c} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.ink }}>Synapse Digital</div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: c.goldDeep, fontWeight: 600, marginTop: 3, textTransform: "uppercase" }}>Plateforme IA RH</div>
          </div>
        </div>

        {!sent ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: c.goldDeep, fontWeight: 600, marginBottom: 6 }}>
                Récupération
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: c.ink, margin: 0 }}>
                Mot de passe oublié
              </h1>
              <p style={{ fontSize: 13.5, color: c.muted, marginTop: 8, lineHeight: 1.5 }}>
                Saisissez votre adresse e-mail professionnelle. Nous vous enverrons un lien de réinitialisation.
              </p>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: c.danger, borderRadius: 10,
                padding: "10px 14px", marginBottom: 16,
                fontSize: 13, color: c.dangerText,
              }}>
                <AlertCircle size={15} />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: c.ink, display: "block", marginBottom: 7 }}>
                  Adresse e-mail professionnelle
                </label>
                <div style={fr}>
                  <Mail size={17} color={c.muted} style={{ flexShrink: 0 }} />
                  <input
                    type="email" placeholder="prenom.nom@entreprise.com"
                    value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                    autoFocus autoComplete="email"
                    style={{ background: "transparent", color: c.ink, outline: "none", border: "none", width: "100%", fontSize: 14, fontFamily: "inherit" }}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: "100%", height: 50, borderRadius: 11,
                background: loading ? c.line : c.gold,
                color: loading ? c.muted : c.onGold,
                border: "none", cursor: loading ? "default" : "pointer",
                fontSize: 15, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all .2s",
              }}>
                {loading
                  ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Envoi en cours…</>
                  : "Envoyer le lien de réinitialisation"
                }
              </button>
            </form>
          </>
        ) : (
          /* Confirmation envoi */
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: c.success, display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle size={32} color={c.successText} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: c.ink, marginBottom: 10 }}>
              Email envoyé !
            </h2>
            <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Si un compte est associé à <strong style={{ color: c.ink }}>{email}</strong>,
              vous recevrez un lien de réinitialisation dans les prochaines minutes.
              Vérifiez également vos spams.
            </p>
            <div style={{ fontSize: 12.5, color: c.muted, marginBottom: 20 }}>
              Le lien expire dans <strong style={{ color: c.ink }}>30 minutes</strong>.
            </div>
          </div>
        )}

        {/* Retour connexion */}
        <button onClick={() => navigate("/login")} style={{
          width: "100%", height: 44, borderRadius: 11, marginTop: 8,
          background: "transparent", color: c.muted,
          border: `1px solid ${c.line}`, cursor: "pointer",
          fontSize: 13.5, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <ArrowLeft size={16} /> Retour à la connexion
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
