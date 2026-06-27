import { useState } from "react";
import { Mail, Briefcase, Building2, BadgeCheck, KeyRound, ShieldCheck, Phone, MapPin, CalendarDays, Cake, UserCog, Camera, Trash2, FileText } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLE_LABELS, STATUS_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMe, updateMyProfile } from "../../../lib/api";

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
      <Icon size={17} color="var(--gold-deep)" />
      <span style={{ fontSize: 13.5, color: "var(--muted)", width: 130 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );
}
export default function Profile() {
  const { t, lang } = useI18n();
  const { currentUser, updateUser } = useSession();
  const { data, loading, error, reload } = useAsync(async () => (await getMe()).data || {});

  // Modif personnelle (téléphone, bio, photo)
  const [form, setForm] = useState(null);     // initialisé au 1er rendu des données
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Changement de mot de passe (mode démo)
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [cf, setCf] = useState("");
  const [msg, setMsg] = useState(null);

  const me = data || {};
  const f = form || { telephone: me.telephone || "", bio: me.bio || "", photo: me.photo || null };
  const name = `${me.prenom || ""} ${me.nom || ""}`.trim() || me.email || "—";

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2_000_000) { window.alert(t("profile.photoTooBig")); return; }
    const r = new FileReader();
    r.onload = () => { setForm({ ...f, photo: r.result }); setSaved(false); };
    r.readAsDataURL(file);
  };
  const saveInfo = async () => {
    setBusy(true); setSaved(false);
    try { await updateMyProfile({ telephone: f.telephone || null, bio: f.bio || null, photo: f.photo || null }); setSaved(true); reload(); }
    catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };
  const changePwd = () => {
    const u = currentUser;
    if (cur !== u.password) { setMsg({ ok: false, text: t("profile.pwdErrCurrent") }); return; }
    if (!nw || nw !== cf) { setMsg({ ok: false, text: t("profile.pwdErrMatch") }); return; }
    updateUser(u.id, { password: nw });
    setCur(""); setNw(""); setCf(""); setMsg({ ok: true, text: t("profile.pwdSaved") });
  };

  const roleLabel = me.role && ROLE_LABELS[me.role] ? ROLE_LABELS[me.role][lang] : (me.role || "—");
  const statusLabel = me.status && STATUS_LABELS[me.status] ? STATUS_LABELS[me.status][lang] : (me.status || "—");
  const gold = { height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("profile.title")}</h1>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Identité + infos détaillées */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              {f.photo ? (
                <img src={f.photo} alt={name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--gold)" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 28 }}>{name.charAt(0)}</div>
              )}
              <div>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{name}</div>
                <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{me.poste || roleLabel}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t("profile.matricule")}: {me.matricule || "—"}</div>
              </div>
            </div>
            <Row icon={Briefcase} label={t("profile.role")} value={roleLabel} />
            <Row icon={Building2} label={t("profile.dept")} value={me.department} />
            <Row icon={UserCog} label={t("profile.manager")} value={me.manager_nom} />
            <Row icon={Mail} label={t("profile.email")} value={me.email} />
            <Row icon={Phone} label={t("profile.phone")} value={me.telephone} />
            <Row icon={MapPin} label={t("profile.location")} value={me.site} />
            <Row icon={FileText} label={t("profile.contract")} value={me.type_contrat} />
            <Row icon={CalendarDays} label={t("profile.hireDate")} value={me.date_embauche} />
            <Row icon={Cake} label={t("profile.birthDate")} value={me.date_naissance} />
            <Row icon={BadgeCheck} label={t("emp.status")} value={statusLabel} />
            {me.bio && <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>{me.bio}</div>}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Édition des infos personnelles */}
            <Card>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("profile.personalInfo")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                {f.photo ? (
                  <img src={f.photo} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 22 }}>{name.charAt(0)}</div>
                )}
                <label style={{ ...gold, height: 36, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <Camera size={15} /> {t("profile.changePhoto")}
                  <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
                </label>
                {f.photo && (
                  <button onClick={() => { setForm({ ...f, photo: null }); setSaved(false); }} title={t("profile.removePhoto")}
                    style={{ height: 36, width: 36, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("profile.phone")}</label>
              <input className="sd-field" style={{ marginTop: 6 }} value={f.telephone} onChange={(e) => { setForm({ ...f, telephone: e.target.value }); setSaved(false); }} placeholder={t("profile.phonePlaceholder")} />
              <label style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, display: "block" }}>{t("profile.bio")}</label>
              <textarea className="sd-field" style={{ marginTop: 6, minHeight: 80 }} value={f.bio} onChange={(e) => { setForm({ ...f, bio: e.target.value }); setSaved(false); }} placeholder={t("profile.bioPlaceholder")} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button onClick={saveInfo} disabled={busy} className="sd-btn sd-btn--gold">{busy ? "…" : t("profile.save")}</button>
                {saved && <span style={{ fontSize: 13, color: "#2e8c57", fontWeight: 600 }}>{t("profile.saved")}</span>}
              </div>
            </Card>

            {/* Changement de mot de passe (démo) */}
            {currentUser?.password !== undefined && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <KeyRound size={18} color="var(--gold-deep)" />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("profile.changePwd")}</div>
                </div>
                <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("profile.current")}</label>
                <input className="sd-field" style={{ marginTop: 6 }} type="password" value={cur} onChange={(e) => { setCur(e.target.value); setMsg(null); }} />
                <label style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, display: "block" }}>{t("profile.new")}</label>
                <input className="sd-field" style={{ marginTop: 6 }} type="password" value={nw} onChange={(e) => { setNw(e.target.value); setMsg(null); }} />
                <label style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, display: "block" }}>{t("profile.confirm")}</label>
                <input className="sd-field" style={{ marginTop: 6 }} type="password" value={cf} onChange={(e) => { setCf(e.target.value); setMsg(null); }} />
                {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "#2e8c57" : "var(--danger)" }}>{msg.text}</div>}
                <button onClick={changePwd} className="sd-btn sd-btn--gold" style={{ marginTop: 14 }}>{t("profile.save")}</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--muted)" }}>
                  <ShieldCheck size={15} color="var(--gold-deep)" /> {t("profile.securityHint")}
                </div>
              </Card>
            )}
          </div>
        </div>
      </AsyncBoundary>
    </div>
  );
}
