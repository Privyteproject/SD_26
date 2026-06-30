import { FileText, ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";

const SOURCES = ["Convention collective.pdf", "Règlement intérieur.pdf", "Politique de congés.pdf", "Procédures RH.pdf"];
const GUARDRAILS = [
  { fr: "Refus des données hors périmètre du rôle", en: "Deny data outside role scope" },
  { fr: "Détection de tentatives de contournement", en: "Detect bypass attempts" },
  { fr: "Journalisation des requêtes sensibles", en: "Log sensitive requests" },
];

export default function Config() {
  const { t, lang } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("cfg.title")}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("cfg.sources")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SOURCES.map((sname) => (
              <div key={sname} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
                <FileText size={16} color="var(--gold-deep)" /> {sname}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{t("cfg.guardrails")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GUARDRAILS.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
                <ShieldCheck size={16} color="var(--gold-deep)" /> {g[lang]}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
