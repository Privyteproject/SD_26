import { useI18n } from "../app/providers/I18nProvider";

export default function PageScaffold({ titleKey, space = "rh" }) {
  const { t } = useI18n();
  const spaceLabel =
    space === "app" ? t("common.collaborator") : space === "admin" ? t("common.admin") : t("common.rh");
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>
        {t(titleKey)}
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>
        {t("scaffold.partOf")} {spaceLabel}
      </p>

      <div style={{
        marginTop: 26, border: "1px dashed var(--gold-soft)", borderRadius: 16,
        background: "var(--surface)", padding: 40, textAlign: "center", color: "var(--muted)",
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12, background: "var(--gold-tint)",
          color: "var(--gold-deep)", display: "inline-flex", alignItems: "center",
          justifyContent: "center", fontWeight: 600, marginBottom: 14,
        }}>
          ✦
        </div>
        <p style={{ margin: 0, maxWidth: 420, marginInline: "auto" }}>{t("scaffold.soon")}</p>
      </div>
    </div>
  );
}
