import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { ExternalLink } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import OverviewBlocks from "../../dashboard/components/OverviewBlocks";
import CareerComparator from "../components/CareerComparator";
import { getProcess } from "../../../lib/api";

// Icône d'onglet (lucide) — mappe les clés renvoyées par le backend.
const TAB_ICON = { userPlus: "UserPlus", target: "Target", award: "Award", heart: "HeartPulse", activity: "Activity" };
const TONE_C = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)", gold: "var(--gold-deep)" };

export default function ProcessScreen({ pkey, titleKey, icon = "Workflow" }) {
  const { t } = useI18n();
  const { role } = useSession();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => getProcess(pkey), [pkey]);
  const [active, setActive] = useState(0);

  const d = (data && data.data) || {};
  const tabs = d.tabs || [];
  const tab = tabs[active] || tabs[0];
  const HeaderIcon = Icons[icon] || Icons.Workflow;

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
          <HeaderIcon size={21} />
        </div>
        <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t(titleKey)}</h1>
        <Badge tone="gold">{role === ROLES.MANAGER ? t("scope.team") : t("scope.org")}</Badge>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <style>{`@media (max-width:820px){ .ps-tabs{ grid-template-columns:1fr!important; } }`}</style>
        {/* Onglets sous forme de CARTES : texte synthétique + indicateur clé à droite */}
        <div className="ps-tabs" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(tabs.length, 1), 4)},1fr)`, gap: 12, marginBottom: 20 }}>
          {tabs.map((tb, i) => {
            const on = i === active;
            const Ico = Icons[TAB_ICON[tb.icon] || "Square"] || Icons.Square;
            const h = tb.headline || {};
            return (
              <button key={tb.key} onClick={() => setActive(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left",
                  borderRadius: "var(--r-lg)", cursor: "pointer",
                  border: `1px solid ${on ? "var(--gold-soft)" : "var(--line)"}`,
                  background: on ? "var(--gold-tint)" : "var(--surface)",
                  boxShadow: on ? "var(--shadow)" : "var(--shadow-sm)", transition: "transform .18s, box-shadow .18s",
                  transform: on ? "translateY(-2px)" : "none",
                }}>
                <div style={{ width: 38, height: 38, borderRadius: "var(--r-md)", flexShrink: 0, display: "grid", placeItems: "center",
                  background: on ? "var(--grad-gold)" : "var(--gold-tint)", color: on ? "var(--on-gold)" : "var(--gold-deep)" }}>
                  <Ico size={19} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{tb.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tb.subtitle}</div>
                </div>
                {h.value !== undefined && h.value !== null && (
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: TONE_C[h.tone] || "var(--ink)", flexShrink: 0 }}>
                    {h.value}{h.unit}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {tab && (
          <>
            {/* Bouton Gérer (ouvre la page de gestion complète) */}
            {tab.manage && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button onClick={() => navigate(tab.manage.route)} className="sd-btn sd-btn--outline sd-btn--sm">
                  <ExternalLink size={15} /> {tab.manage.label || t("process.manage")}
                </button>
              </div>
            )}
            {/* Cartes synthétiques + pattern focus (clic → détails, 2e clic → fermeture) */}
            <OverviewBlocks key={tab.key} blocks={[{ id: tab.key, title: tab.label, icon: tab.icon, hideHeader: true, cards: tab.cards || [] }]} />
          </>
        )}

        {/* Comparateur multi-collaborateurs (sélection) — uniquement sur Gestion de carrières */}
        {pkey === "carrieres" && <CareerComparator />}
      </AsyncBoundary>
    </div>
  );
}
