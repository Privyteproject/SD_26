import { useState } from "react";
import { LifeBuoy, BookOpen, HelpCircle, Gift, ArrowRightLeft, ChevronDown } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";

// Contenu statique bilingue (pas de backend) — centre d'aide / formation (§4.2) + avantages + FAQ (§2).
const GUIDES = {
  COLLABORATEUR: [
    { fr: "Posez vos questions RH à l'assistant IA (congés, paie, procédures) — 24/7.", en: "Ask the AI assistant your HR questions (leave, payroll, procedures) — 24/7." },
    { fr: "Générez une attestation : Documents → Nouvelle demande → aperçu prérempli → confirmer.", en: "Generate a certificate: Documents → New request → prefilled preview → confirm." },
    { fr: "Suivez votre solde de congés et déposez une demande dans « Mes demandes ».", en: "Track your leave balance and submit a request in “My requests”." },
    { fr: "Gérez votre consentement et exportez vos données dans « Confidentialité ».", en: "Manage consent and export your data in “Privacy”." },
  ],
  MANAGER: [
    { fr: "Votre tableau de bord est centré sur votre équipe (engagement, absentéisme, signaux).", en: "Your dashboard focuses on your team (engagement, absenteeism, signals)." },
    { fr: "Validez les compétences et l'avancement des objectifs de votre équipe.", en: "Validate your team's skills and objectives progress." },
    { fr: "Consultez les risques de votre équipe et les plans d'action conseillés.", en: "Review your team's risks and recommended action plans." },
  ],
  RH: [
    { fr: "Pilotez effectifs, turnover, absentéisme et climat depuis le tableau de bord.", en: "Steer headcount, turnover, absenteeism and climate from the dashboard." },
    { fr: "Validez les demandes, documents et publiez des annonces ciblées.", en: "Approve requests, documents and post targeted announcements." },
    { fr: "Complétez le référentiel de compétences et suivez l'onboarding/offboarding.", en: "Maintain the skills framework and track onboarding/offboarding." },
  ],
  DIRECTION: [
    { fr: "Cockpit consolidé : indicateurs par département + projections (effectifs, masse salariale).", en: "Consolidated cockpit: indicators by department + projections (headcount, payroll)." },
  ],
  MEDECINE: [
    { fr: "Vue bien-être : climat et signaux de désengagement, agrégés et anonymisés.", en: "Wellbeing view: climate and disengagement signals, aggregated and anonymized." },
  ],
  ADMIN: [
    { fr: "Supervisez les usages de l'assistant IA et les indicateurs de sécurité.", en: "Supervise AI assistant usage and security indicators." },
    { fr: "Configurez les règles de supervision (mots-clés sensibles) et gérez les utilisateurs.", en: "Configure supervision rules (sensitive keywords) and manage users." },
  ],
};
const FAQ = [
  { q: { fr: "L'assistant remplace-t-il le RH ?", en: "Does the assistant replace HR?" }, a: { fr: "Non. Il répond aux questions courantes et redirige vers un référent humain pour les sujets sensibles.", en: "No. It answers common questions and routes sensitive topics to a human referent." } },
  { q: { fr: "Qui voit mes conversations avec l'IA ?", en: "Who sees my AI conversations?" }, a: { fr: "Le contenu est chiffré et réservé à l'administrateur à des fins de sécurité uniquement.", en: "Content is encrypted and reserved to the admin for security purposes only." } },
  { q: { fr: "Mes commentaires d'humeur sont-ils nominatifs ?", en: "Are my mood comments nominative?" }, a: { fr: "Anonymes par défaut ; un nom n'apparaît que si vous levez explicitement l'anonymat.", en: "Anonymous by default; a name appears only if you explicitly opt out." } },
  { q: { fr: "Comment exporter ou supprimer mes données ?", en: "How to export or delete my data?" }, a: { fr: "Via la page « Confidentialité » : export en un clic, demande d'effacement transmise au RH.", en: "Via the “Privacy” page: one-click export, erasure request sent to HR." } },
];
const AVANTAGES = [
  { fr: "Mutuelle d'entreprise & prévoyance", en: "Company health & life insurance" },
  { fr: "Tickets restaurant", en: "Meal vouchers" },
  { fr: "Télétravail (jusqu'à 2 j/semaine)", en: "Remote work (up to 2 days/week)" },
  { fr: "Budget formation annuel", en: "Annual training budget" },
  { fr: "Congés RTT", en: "RTT days off" },
];

export default function Help() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const guides = GUIDES[role] || GUIDES.COLLABORATEUR;
  const [open, setOpen] = useState(-1);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("help.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px", display: "flex", alignItems: "center", gap: 6 }}>
        <LifeBuoy size={15} color="var(--gold-deep)" /> {t("help.sub")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Prise en main (par rôle) */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}><BookOpen size={17} color="var(--gold-deep)" /> {t("help.guides")}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {guides.map((g, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>{g[lang]}</li>)}
          </ul>
        </Card>

        {/* Avantages sociaux */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}><Gift size={17} color="var(--gold-deep)" /> {t("help.benefits")}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {AVANTAGES.map((a, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>{a[lang]}</li>)}
          </ul>
        </Card>
      </div>

      {/* Mobilité interne */}
      <Card style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <ArrowRightLeft size={18} color="var(--gold-deep)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("help.mobility")}</span>
        <span style={{ fontSize: 13, color: "var(--muted)", flex: 1, minWidth: 220 }}>{t("help.mobilitySub")}</span>
        <a href="/app/assistant" className="sd-btn sd-btn--outline sd-btn--sm">{t("help.mobilityCta")}</a>
      </Card>

      {/* FAQ */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}><HelpCircle size={17} color="var(--gold-deep)" /> {t("help.faq")}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--line)" }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{f.q[lang]}</span>
                <ChevronDown size={16} color="var(--muted)" style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>
              {open === i && <div style={{ fontSize: 13.5, color: "var(--muted)", padding: "0 0 12px", lineHeight: 1.6 }}>{f.a[lang]}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
