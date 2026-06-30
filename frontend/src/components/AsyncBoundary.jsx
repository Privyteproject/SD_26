import { useI18n } from "../app/providers/I18nProvider";
import Card from "./Card";
import EmptyState from "./EmptyState";

// Affiche un état standardisé (chargement / erreur avec ré-essai / vide) autour
// d'un contenu chargé via useAsync. Sinon rend `children`.
export default function AsyncBoundary({ loading, error, empty, emptyLabel, onRetry, children }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)", marginTop: 18 }}>
        {t("common.loading")}
      </Card>
    );
  }

  if (error) {
    const detail = (error && (error.payload?.detail || error.message)) || "";
    return (
      <Card style={{ textAlign: "center", padding: 32, marginTop: 18 }}>
        <div style={{ color: "var(--danger)", fontWeight: 600 }}>{t("common.error")}</div>
        {detail && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{detail}</div>}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ marginTop: 14, height: 38, padding: "0 18px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("common.retry")}
          </button>
        )}
      </Card>
    );
  }

  if (empty) {
    return <Card style={{ marginTop: 18 }}><EmptyState title={emptyLabel || t("common.empty")} /></Card>;
  }

  return children;
}
