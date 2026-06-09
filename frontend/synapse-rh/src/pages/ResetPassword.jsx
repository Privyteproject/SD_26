import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, Sun, Moon, CheckCircle, AlertCircle, Loader, ShieldCheck } from "lucide-react";
import { useApi } from "../auth/useApi";
import { useSecurity } from "../auth/useSecurity";
import { Mark } from "../components/Mark";
import { getColors } from "../theme";

export default function ResetPassword({ dark, setDark: setDarkProp }) {
  const [darkLocal, setDarkLocal] = useState(false);
  const dark_ = dark !== undefined ? dark : darkLocal;
  const setDark = setDarkProp || setDarkLocal;

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState({ pwd: false, conf: false });
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [errors,    setErrors]    = useState({});
  const [tokenValid,setTokenValid]= useState(true);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get("token");
  const api             = useApi();
  const { validators }  = useSecurity();
  const c               = getColors(dark_);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Vérifier la validité du token au montage
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    api.get(`/api/auth/reset-password/verify?token=${token}`)
      .then(res => { if (!res.ok) setTokenValid(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isMobile = vw < 480;

  const pwdStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return [
      { label: "", color: c.line },
      { label: "Faible", color: c.dangerText },
      { label: "Moyen", color: "#E7A020" },
      { label: "Fort", color: "#5BA85A" },
      { label: "Très fort", color: "#2E7D32" },
    ][s];
  };
  const ps = pwdStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    const pwdErr = validators.password(password);
    if (pwdErr) errs.password = pwdErr;
    if (password !== confirm) errs.confirm = "Les mots de passe ne correspondent pas.";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    const res = await api.post("/api/auth/reset-password", { token, newPassword: password });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } else {
      setErrors({ global: "Le lien est expiré ou invalide. Veuillez refaire une demande." });
    }
  }

  const fieldRow = (err) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 14px", height: 48,
    background: c.field,
    border: `1.5px solid ${err ? c.dangerText : c.line}`,
    borderRadius: 11,
  });

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", background: c.bg, color: c.ink,
      padding: isMobile ? 16 : 24,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      transition: "background .4s",
    }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Mark size={32} c={c} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.ink }}>Synapse Digital</div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: c.goldDeep, fontWeight: 600, marginTop: 3, textTransform: "uppercase" }}>Plateforme IA RH</div>
          </div>
        </div>

        {/* Token invalide */}
        {!tokenValid && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: c.danger,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertCircle size={32} color={c.dangerText} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: c.ink, marginBottom: 10 }}>Lien invalide ou expiré</h2>
            <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Ce lien de réinitialisation n'est plus valide. Veuillez refaire une demande.
            </p>
            <button onClick={() => navigate("/forgot-password")} style={{
              width: "100%", height: 48, borderRadius: 11,
              background: c.gold, color: c.onGold, border: "none",
              cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}>
              Nouvelle demande
            </button>
          </div>
        )}

        {/* Succès */}
        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: c.success,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={32} color={c.successText} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: c.ink, marginBottom: 10 }}>Mot de passe modifié !</h2>
            <p style={{ fontSize: 13.5, color: c.muted, lineHeight: 1.6 }}>
              Votre mot de passe a été réinitialisé. Redirection vers la connexion dans 3 secondes…
            </p>
          </div>
        )}

        {/* Formulaire */}
        {tokenValid && !done && (
          <>
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: c.goldDeep, fontWeight: 600, marginBottom: 6 }}>
                Réinitialisation
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: c.ink, margin: 0 }}>
                Nouveau mot de passe
              </h1>
            </div>

            {errors.global && (
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                background: c.danger, borderRadius: 10, padding: "10px 14px",
                marginBottom: 16, fontSize: 13, color: c.dangerText }}>
                <AlertCircle size={15} />{errors.global}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: c.ink, display: "block", marginBottom: 7 }}>
                  Nouveau mot de passe
                </label>
                <div style={fieldRow(errors.password)}>
                  <Lock size={17} color={c.muted} style={{ flexShrink: 0 }} />
                  <input
                    type={showPwd.pwd ? "text" : "password"}
                    placeholder="Minimum 8 caractères"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ background: "transparent", color: c.ink, outline: "none", border: "none", width: "100%", fontSize: 14, fontFamily: "inherit" }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => ({ ...p, pwd: !p.pwd }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex", flexShrink: 0 }}>
                    {showPwd.pwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 3, background: c.line, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(["Faible","Moyen","Fort","Très fort"].indexOf(ps.label)+1)/4*100}%`, background: ps.color, borderRadius: 2, transition: "all .3s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: ps.color, marginTop: 3 }}>{ps.label}</div>
                  </div>
                )}
                {errors.password && <div style={{ fontSize: 12, color: c.dangerText, marginTop: 4 }}>{errors.password}</div>}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: c.ink, display: "block", marginBottom: 7 }}>
                  Confirmer le mot de passe
                </label>
                <div style={fieldRow(errors.confirm)}>
                  <Lock size={17} color={c.muted} style={{ flexShrink: 0 }} />
                  <input
                    type={showPwd.conf ? "text" : "password"}
                    placeholder="Répétez le mot de passe"
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    style={{ background: "transparent", color: c.ink, outline: "none", border: "none", width: "100%", fontSize: 14, fontFamily: "inherit" }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => ({ ...p, conf: !p.conf }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "flex", flexShrink: 0 }}>
                    {showPwd.conf ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm && <div style={{ fontSize: 12, color: c.dangerText, marginTop: 4 }}>{errors.confirm}</div>}
              </div>

              <button type="submit" disabled={loading} style={{
                width: "100%", height: 50, borderRadius: 11, marginTop: 4,
                background: loading ? c.line : c.gold,
                color: loading ? c.muted : c.onGold,
                border: "none", cursor: loading ? "default" : "pointer",
                fontSize: 15, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {loading ? <><Loader size={18} style={{ animation: "spin 1s linear infinite" }} /> Réinitialisation…</> : "Réinitialiser le mot de passe"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18,
              padding: "10px 14px", background: c.surfaceAlt || c.badge, borderRadius: 9,
              fontSize: 11.5, color: c.muted }}>
              <ShieldCheck size={14} color={c.goldDeep} style={{ flexShrink: 0 }} />
              Ce lien est à usage unique et expire dans 30 minutes.
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
