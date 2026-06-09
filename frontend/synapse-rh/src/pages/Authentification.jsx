import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Mail, Lock, Eye, EyeOff, Sun, Moon, ArrowRight,
  KeyRound, AlertCircle, Loader, ShieldCheck
} from "lucide-react";
import { useAuth, ROLES, getDefaultRoute } from "../auth/AuthContext";
import { useSecurity } from "../auth/useSecurity";
import { Mark } from "../components/Mark";

export default function Authentification({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [remember,    setRemember]    = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [ssoLoading,  setSsoLoading]  = useState(false);

  const { login, loginSSO, loginDemo, loading, error, isAuthenticated, role } = useAuth();
  const { validators, validateForm, sanitize } = useSecurity();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || null;

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate(from || getDefaultRoute(role), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const isMobile = vw < 480;
  const pad = isMobile ? 24 : 36;

  const c = dark_
    ? {
        bg: "#140D06", surface: "#241A10", ink: "#F1E7D6",
        muted: "#AE9778", line: "#3A2C1C", gold: "#D7A954",
        goldDeep: "#E7C57F", onGold: "#191108", field: "#1A1109",
        glow: "rgba(215,169,84,.10)",
        shadow: "0 30px 70px -20px rgba(0,0,0,.85)",
        danger: "#3A1010", dangerText: "#E07A7A",
        surfaceAlt: "#1E1508",
      }
    : {
        bg: "#EFE4CF", surface: "#FBF6EC", ink: "#2D2114",
        muted: "#6E5C46", line: "#E6D8BF", gold: "#B8893E",
        goldDeep: "#946B2A", onGold: "#FFFFFF", field: "#FFFFFF",
        glow: "rgba(184,137,62,.16)",
        shadow: "0 30px 70px -20px rgba(120,86,30,.45)",
        danger: "#FDE8E8", dangerText: "#C62828",
        surfaceAlt: "#F5EDD8",
      };

  const fr = (err) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 14px", height: 48,
    background: c.field,
    border: `1.5px solid ${err ? c.dangerText : c.line}`,
    borderRadius: 11,
    transition: "border-color .2s",
  });

  const inp = {
    background: "transparent", color: c.ink,
    outline: "none", border: "none",
    width: "100%", fontSize: 14,
    fontFamily: "inherit",
  };

  const Err = ({ msg }) => msg ? (
    <div style={{ display: "flex", alignItems: "center", gap: 5,
      marginTop: 5, fontSize: 12, color: c.dangerText }}>
      <AlertCircle size={12} />{msg}
    </div>
  ) : null;

  async function handleLogin(e) {
    e.preventDefault();
    const { valid, errors } = validateForm({
      email:    [email,    [validators.email]],
      password: [password, [(v) => v ? null : "Mot de passe requis."]],
    });
    if (!valid) { setFieldErrors(errors); return; }
    setFieldErrors({});
    const res = await login(sanitize(email), password);
    if (res.ok) navigate(from || getDefaultRoute(res.role), { replace: true });
  }

  async function handleSSO() {
    setSsoLoading(true);
    const res = await loginSSO();
    setSsoLoading(false);
    if (res?.ok) navigate(getDefaultRoute(res.role), { replace: true });
  }

  function handleDemo(r) {
    const res = loginDemo(r);
    if (res.ok) navigate(getDefaultRoute(res.role), { replace: true });
  }

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
        backgroundImage: `radial-gradient(${c.glow}, transparent 65%)`,
        backgroundSize: "700px 700px",
        backgroundPosition: "center -100px",
        backgroundRepeat: "no-repeat",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${dark_ ? "rgba(215,169,84,.04)" : "rgba(120,86,30,.04)"} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }} />

      {/* Toggle thème */}
      <button onClick={() => setDark(!dark_)}
        style={{
          position: "absolute", top: isMobile ? 14 : 24, right: isMobile ? 14 : 24,
          width: 38, height: 38, borderRadius: 9,
          border: `1px solid ${c.line}`, background: c.surface,
          color: c.ink, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        {dark_ ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Carte principale */}
      <div style={{
        background: c.surface,
        border: `1px solid ${c.line}`,
        borderRadius: 22,
        padding: `${pad}px`,
        width: "100%", maxWidth: 420,
        boxShadow: c.shadow,
        position: "relative",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Mark size={36} c={c} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.ink }}>Synapse Digital</div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: c.goldDeep, fontWeight: 600, marginTop: 3, textTransform: "uppercase" }}>Plateforme IA RH</div>
          </div>
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: c.goldDeep, fontWeight: 600, marginBottom: 6 }}>
            Accès sécurisé
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: c.ink, margin: 0 }}>
            Connexion
          </h1>
        </div>

        {/* Erreur globale API */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: c.danger, borderRadius: 10,
            padding: "11px 14px", marginBottom: 18,
            fontSize: 13, color: c.dangerText,
          }}>
            <AlertCircle size={16} />{error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: c.ink, display: "block", marginBottom: 7 }}>
              Adresse e-mail
            </label>
            <div style={fr(fieldErrors.email)}>
              <Mail size={17} color={c.muted} style={{ flexShrink: 0 }} />
              <input
                style={inp} type="email"
                placeholder="prenom.nom@entreprise.com"
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" autoFocus
              />
            </div>
            <Err msg={fieldErrors.email} />
          </div>

          {/* Mot de passe */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: c.ink }}>Mot de passe</label>
              <button type="button" onClick={() => navigate("/forgot-password")}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: c.goldDeep, fontWeight: 600 }}>
                Mot de passe oublié ?
              </button>
            </div>
            <div style={fr(fieldErrors.password)}>
              <Lock size={17} color={c.muted} style={{ flexShrink: 0 }} />
              <input
                style={inp} type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex", flexShrink: 0 }}>
                {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <Err msg={fieldErrors.password} />
          </div>

          {/* Rester connecté */}
          <label style={{
            display: "flex", alignItems: "center", gap: 9,
            cursor: "pointer", userSelect: "none",
            fontSize: 13, color: c.muted,
          }} onClick={() => setRemember(!remember)}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 19, height: 19, borderRadius: 5, flexShrink: 0,
              border: `1.5px solid ${remember ? c.gold : c.line}`,
              background: remember ? c.gold : "transparent",
              transition: "all .2s",
            }}>
              {remember && <ArrowRight size={11} color={c.onGold} strokeWidth={3} style={{ transform: "rotate(-45deg) scale(.8)" }} />}
            </span>
            Rester connecté
          </label>

          {/* Bouton connexion */}
          <button type="submit" disabled={loading}
            style={{
              width: "100%", height: 50, borderRadius: 11,
              background: loading ? c.line : c.gold,
              color: loading ? c.muted : c.onGold,
              border: "none", cursor: loading ? "default" : "pointer",
              fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all .2s",
              marginTop: 4,
            }}>
            {loading
              ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Connexion en cours…</>
              : <>Se connecter <ArrowRight size={18} /></>
            }
          </button>

          {/* Séparateur */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: c.line }} />
            <span style={{ fontSize: 12, color: c.muted }}>ou</span>
            <span style={{ flex: 1, height: 1, background: c.line }} />
          </div>

          {/* SSO Keycloak */}
          <button type="button" onClick={handleSSO} disabled={ssoLoading}
            style={{
              width: "100%", height: 46, borderRadius: 11,
              background: "transparent", color: c.ink,
              border: `1.5px solid ${c.gold}`,
              cursor: ssoLoading ? "default" : "pointer",
              fontSize: 13.5, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all .2s",
            }}>
            {ssoLoading
              ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
              : <KeyRound size={16} color={c.goldDeep} />
            }
            Continuer avec Keycloak (SSO)
          </button>
        </form>

        {/* Mention sécurité */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          marginTop: 22, padding: "11px 14px",
          background: c.surfaceAlt, borderRadius: 9,
          fontSize: 11.5, color: c.muted,
        }}>
          <ShieldCheck size={14} color={c.goldDeep} style={{ flexShrink: 0 }} />
          Connexion chiffrée · Accès contrôlé par rôle · Données RH protégées
        </div>
      </div>

      {/* Démo rapide — DEV UNIQUEMENT */}
      {import.meta.env.DEV && (
        <div style={{
          width: "100%", maxWidth: 420,
          background: c.surface, border: `1px solid ${c.line}`,
          borderRadius: 14, padding: "14px 18px",
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: c.muted, fontWeight: 600, marginBottom: 10 }}>
            Accès démo — dev uniquement
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { role: ROLES.COLLABORATEUR, label: "Collaborateur" },
              { role: ROLES.MANAGER,       label: "Manager"       },
              { role: ROLES.RH,            label: "RH"            },
              { role: ROLES.ADMIN,         label: "Admin"         },
            ].map(({ role, label }) => (
              <button key={role} onClick={() => handleDemo(role)} style={{
                background: c.surfaceAlt, border: `1px solid ${c.line}`,
                borderRadius: 7, padding: "6px 13px",
                cursor: "pointer", fontSize: 12.5, color: c.ink, fontWeight: 500,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
