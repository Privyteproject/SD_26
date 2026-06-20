import { useState } from "react";
import { AlertTriangle, ShieldAlert, Check, Calendar, LifeBuoy, Activity, FileWarning } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getPrioritizedAlertes, resolveAlerte } from "../../../lib/api";

const gravTone = { high: "danger", mid: "warning", low: "info" };
const ICON = { securite: ShieldAlert, acces_refuse: ShieldAlert, acces_refuse_repete: ShieldAlert,
  escalade: LifeBuoy, absence: Calendar, risque_eleve: Activity, fuite_donnees: FileWarning };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

// Worklist RH : situations nécessitant une intervention humaine, triées par criticité.
export default function Alerts() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getPrioritizedAlertes();
    return (res && res.data) || [];
  });
  const alertes = data || [];
  const [busy, setBusy] = useState(null);

  const resolve = async (id) => {
    setBusy(id);
    try { await resolveAlerte(id); reload(); } catch (e) { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("al.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("al.worklist")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!alertes.length} emptyLabel={t("al.empty")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alertes.map((a) => {
            const Icon = ICON[a.categorie] || AlertTriangle;
            return (
              <Card key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, opacity: busy === a.id ? 0.5 : 1, borderColor: a.gravite === "high" ? "var(--danger)" : "var(--line)" }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--gold-tint)", color: a.gravite === "high" ? "var(--danger)" : "var(--gold-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{a.message}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.categorie} · {fmt(a.date_creation, lang)}</div>
                </div>
                <Badge tone={gravTone[a.gravite] || "info"}>{a.gravite}</Badge>
                <button onClick={() => resolve(a.id)} disabled={busy === a.id} title={t("al.resolve")} style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--success, #2e8c57)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                  <Check size={15} /> {t("al.resolve")}
                </button>
              </Card>
            );
          })}
        </div>
      </AsyncBoundary>
    </div>
  );
}
