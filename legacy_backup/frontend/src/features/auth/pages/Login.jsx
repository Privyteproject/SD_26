import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound, User, Check, ShieldCheck } from "lucide-react";
import Logo from "../../../components/Logo";
import LanguageToggle from "../../../components/LanguageToggle";
import ThemeToggle from "../../../components/ThemeToggle";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";

export default function Login() {
  const { t } = useI18n();
  const { login } = useSession();
  const navigate = useNavigate();

  const [flipped, setFlipped] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);

  const enter = () => { login(ROLES.COLLABORATEUR); navigate("/app"); };

  const CARD_H = 612;
  const fieldRow = { background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 12px" };
  const input = { background: "transparent", color: "var(--ink)", outline: "none", border: "none", width: "100%", fontSize: 14, fontFamily: "inherit" };
  const label = { fontSize: 13, fontWeight: 500, color: "var(--ink)" };
  const face = {
    position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 30,
    display: "flex", flexDirection: "column", boxShadow: "var(--shadow)", overflow: "hidden",
  };
  const eyebrow = { fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: "var(--gold-deep)", fontWeight: 600 };
  const linkBtn = { background: "none", border: "none", color: "var(--gold-deep)", fontWeight: 600, cursor: "pointer", fontSize: 13 };

  const Brand = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Logo />
      <span style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Synapse</span>
        <span style={{ display: "block", fontSize: 9, letterSpacing: 3, color: "var(--gold-deep)", fontWeight: 600, marginTop: 2 }}>DIGITAL</span>
      </span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: 24, background: "var(--bg)" }}>
      <div style={{ position: "absolute", top: 24, right: 24, display: "flex", gap: 10 }}>
        <LanguageToggle /><ThemeToggle />
      </div>

      <div style={{ perspective: 1600, width: "100%", maxWidth: 412 }}>
        <div style={{ position: "relative", width: "100%", height: CARD_H, transformStyle: "preserve-3d", transition: "transform .75s cubic-bezier(.2,.7,.3,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>

          <div style={{ ...face, pointerEvents: flipped ? "none" : "auto" }}>
            <Brand />
            <div style={{ marginTop: 22 }}>
              <p style={eyebrow}>{t("login.eyebrow")}</p>
              <h2 className="font-display" style={{ fontSize: 25, fontWeight: 600, marginTop: 6, color: "var(--ink)" }}>{t("login.title")}</h2>
            </div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
              <div>
                <label style={label}>{t("login.email")}</label>
                <div style={{ ...fieldRow, marginTop: 6 }}>
                  <Mail size={17} color="var(--muted)" />
                  <input style={input} type="email" placeholder="prenom.nom@entreprise.com" />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={label}>{t("login.password")}</label>
                  <span style={{ fontSize: 12, color: "var(--gold-deep)", fontWeight: 600 }}>{t("login.forgot")}</span>
                </div>
                <div style={{ ...fieldRow, marginTop: 6 }}>
                  <Lock size={17} color="var(--muted)" />
                  <input style={input} type={showPwd ? "text" : "password"} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--muted)" }} onClick={() => setRemember(!remember)}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, border: `1px solid ${remember ? "var(--gold)" : "var(--line)"}`, background: remember ? "var(--gold)" : "transparent" }}>
                  {remember && <Check size={12} color="var(--on-gold)" strokeWidth={3} />}
                </span>
                {t("login.remember")}
              </label>
              <button type="button" onClick={enter} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--gold)", color: "var(--on-gold)", height: 48, borderRadius: 9, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}>
                {t("login.submit")} <ArrowRight size={18} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--muted)" }}>
                <span style={{ flex: 1, height: 1, background: "var(--line)" }} /><span style={{ fontSize: 12 }}>ou</span><span style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
              <button type="button" onClick={enter} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", color: "var(--ink)", height: 44, borderRadius: 9, fontSize: 13.5, fontWeight: 600, border: "1px solid var(--gold)", cursor: "pointer" }}>
                <KeyRound size={16} color="var(--gold-deep)" /> {t("login.sso")}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              {t("login.noAccount")} <button onClick={() => setFlipped(true)} style={linkBtn}>{t("login.signup")}</button>
            </p>
          </div>

          <div style={{ ...face, transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none" }}>
            <Brand />
            <div style={{ marginTop: 22 }}>
              <p style={eyebrow}>{t("login.signupEyebrow")}</p>
              <h2 className="font-display" style={{ fontSize: 25, fontWeight: 600, marginTop: 6, color: "var(--ink)" }}>{t("login.signupTitle")}</h2>
            </div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
              <div>
                <label style={label}>{t("login.fullname")}</label>
                <div style={{ ...fieldRow, marginTop: 6 }}><User size={17} color="var(--muted)" /><input style={input} placeholder="Prénom Nom" /></div>
              </div>
              <div>
                <label style={label}>{t("login.email")}</label>
                <div style={{ ...fieldRow, marginTop: 6 }}><Mail size={17} color="var(--muted)" /><input style={input} type="email" placeholder="prenom.nom@entreprise.com" /></div>
              </div>
              <div>
                <label style={label}>{t("login.password")}</label>
                <div style={{ ...fieldRow, marginTop: 6 }}>
                  <Lock size={17} color="var(--muted)" />
                  <input style={input} type={showPwd ? "text" : "password"} placeholder="8+ caractères" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }} onClick={() => setTerms(!terms)}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `1px solid ${terms ? "var(--gold)" : "var(--line)"}`, background: terms ? "var(--gold)" : "transparent" }}>
                  {terms && <Check size={12} color="var(--on-gold)" strokeWidth={3} />}
                </span>
                {t("login.terms")}
              </label>
              <button type="button" onClick={enter} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--gold)", color: "var(--on-gold)", height: 48, borderRadius: 9, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}>
                {t("login.createAccount")} <ArrowRight size={18} />
              </button>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                <ShieldCheck size={15} color="var(--gold-deep)" style={{ flexShrink: 0, marginTop: 1 }} />
                {t("login.secure")}
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              {t("login.hasAccount")} <button onClick={() => setFlipped(false)} style={linkBtn}>{t("login.title")}</button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
