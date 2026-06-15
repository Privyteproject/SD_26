import { Mail, Phone, MapPin, Briefcase, Building2, User, Clock, FileText, Settings, ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import { PROFILE } from "../../../mock/mockData";

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
      <Icon size={17} color="var(--gold-deep)" />
      <span style={{ fontSize: 13.5, color: "var(--muted)", width: 120 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function Profile() {
  const { t, lang } = useI18n();
  const p = PROFILE;
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("profile.title")}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 24 }}>{p.name.charAt(0)}</div>
            <div>
              <div className="font-display" style={{ fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{p.role[lang]}</div>
            </div>
          </div>
          <Row icon={Briefcase} label={t("profile.role")} value={p.role[lang]} />
          <Row icon={Building2} label={t("profile.dept")} value={p.dept[lang]} />
          <Row icon={User} label={t("profile.manager")} value={p.manager} />
          <Row icon={Mail} label={t("profile.email")} value={p.email} />
          <Row icon={Phone} label={t("profile.phone")} value={p.phone} />
          <Row icon={MapPin} label={t("profile.location")} value={p.location} />
          <Row icon={Clock} label={t("profile.seniority")} value={p.seniority[lang]} />
          <Row icon={FileText} label={t("profile.contract")} value={p.contract} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Settings size={18} color="var(--gold-deep)" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("profile.prefs")}</div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{t("profile.prefsHint")}</p>
          </Card>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <ShieldCheck size={18} color="var(--gold-deep)" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("profile.security")}</div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>{t("profile.securityHint")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
