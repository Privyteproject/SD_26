import { useI18n } from "../app/providers/I18nProvider";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer
      style={{
        borderTop: "1px solid var(--line)", padding: "16px 26px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 12.5, color: "var(--muted)", flexWrap: "wrap", gap: 8,
      }}
    >
      <span>© 2026 Synapse Digital — {t("footer.rights")}</span>
      <span style={{ color: "var(--gold-deep)" }}>{t("footer.demo")}</span>
    </footer>
  );
}
