import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound, AlertCircle, LogIn } from "lucide-react";
import Logo from "../../../components/Logo";
import LanguageToggle from "../../../components/LanguageToggle";
import ThemeToggle from "../../../components/ThemeToggle";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import { homeForRole } from "../../../lib/rbac";
import { loadUsers, DEMO_PASSWORD } from "../../../lib/authStore";
import { DEV_ACCOUNTS } from "../../../lib/devAuth";

export default function Login() {
  const { t, lang } = useI18n();
  const { login, useMock } = useSession();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  const demoAccounts = loadUsers();

  const submit = async (e, mail = email, password = pwd) => {
    if (e) e.preventDefault();
    setLoading(true);
    const res = await login(mail, password);
    setLoading(false);
    if (!res.ok) { setError(true); return; }
    setError(false);
    navigate(homeForRole(res.user.role));
  };
  const useAccount = (acc) => { setEmail(acc.email); setPwd(DEMO_PASSWORD); submit(null, acc.email, DEMO_PASSWORD); };

  const fieldRow = { background: "var(--field)", border: "1px solid var(--line)", borderRadius: 10, height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 12px" };
  const input = { background: "transparent", color: "var(--ink)", outline: "none", border: "none", width: "100%", fontSize: 14, fontFamily: "inherit" };
  const label = { fontSize: 13, fontWeight: 500, color: "var(--ink)" };
  const eyebrow = { fontSize: 11.5, letterSpacing: 2, textTransform: "uppercase", color: "var(--gold-deep)", fontWeight: 600 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: 24, background: "var(--bg)" }}>
      <div style={{ position: "absolute", top: 24, right: 24, display: "flex", gap: 10 }}>
        <LanguageToggle /><ThemeToggle />
      </div>

      <div style={{ width: "100%", maxWidth: 412 }}>
        <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 30, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo />
            <span style={{ lineHeight: 1 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Synapse</span>
              <span style={{ display: "block", fontSize: 9, letterSpacing: 3, color: "var(--gold-deep)", fontWeight: 600, marginTop: 2 }}>DIGITAL</span>
            </span>
          </div>

          <div style={{ marginTop: 22 }}>
            <p style={eyebrow}>{t("login.eyebrow")}</p>
            <h2 className="font-display" style={{ fontSize: 25, fontWeight: 600, marginTop: 6, color: "var(--ink)" }}>{t("login.title")}</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{t("login.sub")}</p>
          </div>

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>{t("login.email")}</label>
              <div style={{ ...fieldRow, marginTop: 6 }}>
                <Mail size={17} color="var(--muted)" />
                <input style={input} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(false); }} placeholder="prenom.nom@synapse.io" autoComplete="username" />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label style={label}>{t("login.password")}</label>
                <span style={{ fontSize: 12, color: "var(--gold-deep)", fontWeight: 600 }}>{t("login.forgot")}</span>
              </div>
              <div style={{ ...fieldRow, marginTop: 6 }}>
                <Lock size={17} color="var(--muted)" />
                <input style={input} type={showPwd ? "text" : "password"} value={pwd} onChange={(e) => { setPwd(e.target.value); setError(false); }} placeholder="••••••••" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--danger)", background: "rgba(180,64,46,.10)", borderRadius: 9, padding: "9px 12px" }}>
                <AlertCircle size={16} /> {t("login.error")}
              </div>
            )}

            <button type="submit" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--gold)", color: "var(--on-gold)", height: 48, borderRadius: 9, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {loading ? "…" : t("login.submit")} <ArrowRight size={18} />
            </button>

            <button type="button" disabled title="Keycloak — à venir" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", color: "var(--muted)", height: 44, borderRadius: 9, fontSize: 13.5, fontWeight: 600, border: "1px solid var(--line)", cursor: "not-allowed", fontFamily: "inherit" }}>
              <KeyRound size={16} /> {t("login.sso")}
            </button>
          </div>

          <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 16, marginBottom: 0 }}>{t("login.secure")}</p>
        </form>

        {/* Comptes de démonstration (mode démo uniquement) */}
        {useMock && (
        <div style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <button type="button" onClick={() => setShowDemo(!showDemo)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)", fontWeight: 600, fontSize: 13.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><LogIn size={16} color="var(--gold-deep)" /> {t("login.demoTitle")}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{showDemo ? "▲" : "▼"}</span>
          </button>
          {showDemo && (
            <div style={{ borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 16px" }}>{t("login.demoHint")} <code style={{ color: "var(--gold-deep)" }}>{DEMO_PASSWORD}</code></div>
              {demoAccounts.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: "1px solid var(--line)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{a.name.charAt(0)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ROLE_LABELS[a.role][lang]}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.email}</div>
                  </div>
                  <button type="button" onClick={() => useAccount(a)} style={{ flexShrink: 0, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--gold)", background: "transparent", color: "var(--gold-deep)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t("login.use")}</button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Comptes de démonstration (mode réel : dev-login local, backend FastAPI) */}
        {!useMock && (
        <div style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <button type="button" onClick={() => setShowDemo(!showDemo)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)", fontWeight: 600, fontSize: 13.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><LogIn size={16} color="var(--gold-deep)" /> {t("login.demoTitle")}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{showDemo ? "▲" : "▼"}</span>
          </button>
          {showDemo && (
            <div style={{ borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 16px" }}>{t("login.demoHint")} <code style={{ color: "var(--gold-deep)" }}>{DEMO_PASSWORD}</code></div>
              {DEV_ACCOUNTS.map((a) => (
                <div key={a.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: "1px solid var(--line)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{a.name.charAt(0)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ROLE_LABELS[a.role][lang]}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.email}</div>
                  </div>
                  <button type="button" onClick={() => useAccount(a)} style={{ flexShrink: 0, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--gold)", background: "transparent", color: "var(--gold-deep)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t("login.use")}</button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
