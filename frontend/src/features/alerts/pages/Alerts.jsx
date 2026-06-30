import { useState } from "react";
import { AlertTriangle, ClipboardList, ShieldAlert, Check, Calendar, LifeBuoy, Activity, FileWarning, X } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getPrioritizedAlertes, resolveAlerte, getActionPlan } from "../../../lib/api";

const gravTone = { high: "danger", mid: "warning", low: "info" };
const ICON = { securite: ShieldAlert, acces_refuse: ShieldAlert, acces_refuse_repete: ShieldAlert,
  escalade: LifeBuoy, absence: Calendar, risque_eleve: Activity, fuite_donnees: FileWarning };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

// Worklist RH : situations nécessitant une intervention humaine, triées par criticité.
export default function Alerts() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getPrioritizedAlertes({ include_resolved: false });
    return (res && res.data) || [];
  });
  const alertes = data || [];
  const [busy, setBusy] = useState(null);

  // Modal State
  const [modalAlerte, setModalAlerte] = useState(null);
  const [modalAiResult, setModalAiResult] = useState(null);
  const [selectedPlans, setSelectedPlans] = useState([]);

  const loadPlan = async (a) => {
    setBusy(a.id + "-plan");
    try {
      const res = await getActionPlan(a.matricule);
      setModalAiResult(res && res.data ? res.data : { actions: [t("al.noReco")] });
      setSelectedPlans([]);
      setModalAlerte(a);
    } catch (e) { /* ignore */ } finally { setBusy(null); }
  };

  const resolve = async (id) => {
    setBusy(id);
    try { await resolveAlerte(id); reload(); } catch (e) { /* ignore */ } finally { setBusy(null); }
  };

  const submitPlan = async () => {
    if (!modalAlerte || selectedPlans.length === 0) return;
    setBusy("submit-plan");
    try {
      await resolveAlerte(modalAlerte.id);
      window.dispatchEvent(new CustomEvent("toast", { detail: { type: "success", message: t("al.planSubmitted") } }));
      setModalAlerte(null);
      reload();
    } catch (e) {
      window.dispatchEvent(new CustomEvent("toast", { detail: { type: "error", message: t("al.planError") } }));
    } finally {
      setBusy(null);
    }
  };

  const planOptions = [
    t("al.opt.interview"),
    t("al.opt.workload"),
    t("al.opt.mgr"),
    t("al.opt.training"),
    t("al.opt.mobility"),
  ];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("al.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("al.worklist")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!alertes.length} emptyLabel={t("al.empty")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alertes.map((a) => {
            const Icon = ICON[a.categorie] || AlertTriangle;
            return (
              <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Card style={{ display: "flex", alignItems: "center", gap: 14, opacity: busy === a.id ? 0.5 : 1, borderColor: a.gravite === "high" && !a.resolue ? "var(--danger)" : "var(--line)" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: a.resolue ? "var(--field)" : "var(--gold-tint)", color: a.resolue ? "var(--muted)" : (a.gravite === "high" ? "var(--danger)" : "var(--gold-deep)"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: a.resolue ? "var(--muted)" : "var(--ink)", textDecoration: a.resolue ? "line-through" : "none" }}>{a.message}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.categorie} · {fmt(a.date_creation, lang)}</div>
                  </div>
                  
                  {a.resolue ? (
                    <Badge tone="success">{t("al.handled")}</Badge>
                  ) : (
                    <Badge tone="warning">{t("al.unresolved")}</Badge>
                  )}

                  {!a.resolue && a.matricule && (
                    <button onClick={() => loadPlan(a)} disabled={busy === a.id + "-plan"} title={t("al.viewPlan")} className="sd-btn sd-btn--outline sd-btn--sm">
                      <ClipboardList size={15} /> {t("dis.actionPlan")}
                    </button>
                  )}
                  {!a.resolue && !a.matricule && (
                    <button onClick={() => resolve(a.id)} disabled={busy === a.id} title={t("al.markResolved")} className="sd-btn sd-btn--outline sd-btn--sm">
                      <Check size={15} /> {t("al.resolve")}
                    </button>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </AsyncBoundary>

      {/* Modal Plan d'action */}
      {modalAlerte && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, width: 500, maxWidth: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={20} color="var(--gold-deep)" />
                {t("al.proposePlan")}
              </h2>
              <button onClick={() => setModalAlerte(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{t("al.concerns")}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", padding: "10px 14px", background: "var(--field)", borderRadius: 8, border: "1px solid var(--line)" }}>
                  {modalAlerte.message}
                </div>
              </div>

              {modalAiResult && (
                <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--gold-tint)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.3)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-deep)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    {t("al.aiReco")}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink)", fontSize: 13.5, lineHeight: 1.5 }}>
                    {(modalAiResult.actions || []).map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                {t("al.selectActions")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {planOptions.map(option => (
                  <label key={option} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14.5, color: "var(--ink)", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, transition: "0.2s", background: selectedPlans.includes(option) ? "var(--gold-tint)" : "transparent", borderColor: selectedPlans.includes(option) ? "var(--gold)" : "var(--line)" }}>
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }}
                      checked={selectedPlans.includes(option)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPlans(p => [...p, option]);
                        else setSelectedPlans(p => p.filter(x => x !== option));
                      }} 
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 12, background: "var(--surface)", borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button
                onClick={() => setModalAlerte(null)}
                className="sd-btn sd-btn--outline"
              >
                {t("al.cancel")}
              </button>
              <button
                disabled={selectedPlans.length === 0 || busy === "submit-plan"}
                onClick={submitPlan}
                className="sd-btn sd-btn--gold"
              >
                {busy === "submit-plan" ? t("al.submitting") : t("al.submitPlan")}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
