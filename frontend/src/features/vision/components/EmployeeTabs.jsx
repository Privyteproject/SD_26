import { useEffect, useState } from "react";
import { LayoutGrid, Route, HeartPulse, Award, Target, CalendarClock } from "lucide-react";
import OverviewBlocks from "../../dashboard/components/OverviewBlocks";
import { getVisionTab } from "../../../lib/api";

const TONE_C = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)", gold: "var(--gold-deep)" };

const TABS = [
  { key: "synthese", label: "Synthèse", icon: LayoutGrid, ic: "layoutGrid", title: "Synthèse", subtitle: "Profil, niveau & objectifs" },
  { key: "lifecycle", label: "Onb./Offb.", icon: Route, ic: "route", title: "Parcours d'intégration & départ", subtitle: "Onboarding & offboarding" },
  { key: "climat", label: "Climat", icon: HeartPulse, ic: "heartPulse", title: "Climat (agrégé & anonymisé)", subtitle: "Climat du département" },
  { key: "competences", label: "Compétences", icon: Award, ic: "award", title: "Gestion des compétences", subtitle: "Compétences & trajectoire" },
  { key: "objectifs", label: "Objectifs", icon: Target, ic: "target", title: "Objectifs & résultats clés", subtitle: "OKR & bilans" },
  { key: "activite", label: "Activité", icon: CalendarClock, ic: "calendarClock", title: "Activité & demandes", subtitle: "Absences, congés, feedbacks" },
];

export default function EmployeeTabs({ matricule }) {
  const [active, setActive] = useState("synthese");
  const [cache, setCache] = useState({}); // { [tab]: { loading, error, cards } }

  // Préchargement de tous les onglets (pour afficher l'indicateur clé sur chaque carte-onglet).
  useEffect(() => {
    let alive = true;
    setCache({});
    TABS.forEach((t) => {
      getVisionTab(matricule, t.key).then(
        (res) => alive && setCache((c) => ({ ...c, [t.key]: { cards: (res && res.data && res.data.cards) || [] } })),
        () => alive && setCache((c) => ({ ...c, [t.key]: { error: true, cards: [] } }))
      );
    });
    return () => { alive = false; };
  }, [matricule]);

  const meta = TABS.find((t) => t.key === active);
  const state = cache[active];

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`@media (max-width:900px){ .et-tabs{ grid-template-columns:repeat(2,1fr)!important; } }`}</style>
      {/* Onglets sous forme de cartes (même design que Processus RH) */}
      <div className="et-tabs" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 18 }}>
        {TABS.map((t) => {
          const on = t.key === active;
          const Icon = t.icon;
          const first = (cache[t.key]?.cards || [])[0];
          const h = first ? { value: first.value, unit: first.unit, tone: first.tone } : null;
          return (
            <button key={t.key} onClick={() => setActive(t.key)}
              style={{
                display: "flex", flexDirection: "column", gap: 8, padding: "12px 13px", textAlign: "left", cursor: "pointer",
                borderRadius: "var(--r-lg)", border: `1px solid ${on ? "var(--gold-soft)" : "var(--line)"}`,
                background: on ? "var(--gold-tint)" : "var(--surface)", boxShadow: on ? "var(--shadow)" : "var(--shadow-sm)",
                transform: on ? "translateY(-2px)" : "none", transition: "transform .18s, box-shadow .18s",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--r-md)", display: "grid", placeItems: "center",
                  background: on ? "var(--grad-gold)" : "var(--gold-tint)", color: on ? "var(--on-gold)" : "var(--gold-deep)" }}>
                  <Icon size={16} />
                </div>
                {h && h.value !== undefined && h.value !== null && (
                  <span style={{ fontSize: 16, fontWeight: 700, color: TONE_C[h.tone] || "var(--ink)" }}>{h.value}{h.unit}</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      <div style={{ minHeight: 200 }}>
        {!state && <div style={{ color: "var(--muted)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>Chargement…</div>}
        {state && state.error && <div style={{ color: "var(--danger)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>Données indisponibles pour cet onglet.</div>}
        {state && !state.error && (
          <OverviewBlocks key={active} blocks={[{ id: active, title: meta.title, icon: meta.ic, hideHeader: true, cards: state.cards || [] }]} />
        )}
      </div>
    </div>
  );
}
