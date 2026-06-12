import { useState } from "react";
import { Mail, Briefcase, Building2, BadgeCheck, KeyRound, ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLE_LABELS, STATUS_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
      <Icon size={17} color="var(--gold-deep)" />
      <span style={{ fontSize: 13.5, color: "var(--muted)", width: 120 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
const inp = { height: 42, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", marginTop: 6 };

export default function Profile() {
  const { t, lang } = useI18n();
  const { currentUser, updateUser } = useSession();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [msg, setMsg] = useState(null); // {ok, text}

  if (!currentUser) return null;
  const u = currentUser;

  const change = () => {
    if (cur !== u.password) { setMsg({ ok: false, text: t("profile.pwdErrCurrent") }); return; }
    if (!nw || nw !== cf) { setMsg({ ok: false, text: t("profile.pwdErrMatch") }); return; }
    updateUser(u.id, { password: nw });
    setCur(""); setNw(""); setCf(""); setMsg({ ok: true, text: t("profile.pwdSaved") });
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("profile.title")}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 24 }}>{u.name.charAt(0)}</div>
            <div>
              <div className="font-display" style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>{u.name}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{ROLE_LABELS[u.role][lang]}</div>
            </div>
          </div>
          <Row icon={Briefcase} label={t("profile.role")} value={ROLE_LABELS[u.role][lang]} />
          <Row icon={Building2} label={t("profile.dept")} value={u.dept} />
          <Row icon={Mail} label={t("profile.email")} value={u.email} />
          <Row icon={BadgeCheck} label={t("emp.status")} value={STATUS_LABELS[u.status][lang]} />
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <KeyRound size={18} color="var(--gold-deep)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("profile.changePwd")}</div>
          </div>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("profile.current")}</label>
          <input style={inp} type="password" value={cur} onChange={(e) => { setCur(e.target.value); setMsg(null); }} />
          <label style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, display: "block" }}>{t("profile.new")}</label>
          <input style={inp} type="password" value={nw} onChange={(e) => { setNw(e.target.value); setMsg(null); }} />
          <label style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, display: "block" }}>{t("profile.confirm")}</label>
          <input style={inp} type="password" value={cf} onChange={(e) => { setCf(e.target.value); setMsg(null); }} />
          {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</div>}
          <button onClick={change} style={{ marginTop: 14, height: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{t("profile.save")}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--muted)" }}>
            <ShieldCheck size={15} color="var(--gold-deep)" /> {t("profile.securityHint")}
          </div>
        </Card>
      </div>
    </div>
  );
}
