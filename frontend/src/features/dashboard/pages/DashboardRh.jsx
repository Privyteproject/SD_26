import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ScanFace, Zap, Inbox, BadgeCheck, Users, ChevronRight } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import OverviewBlocks from "../components/OverviewBlocks";
import AgendaTasks from "../components/AgendaTasks";
import {
  getDashboardOverview, getDashboardRh, getEmployees,
  calculateRisques, trainRiskModels, getRiskPrediction, batchScoreRisks,
} from "../../../lib/api";

const riskTone = { high: "danger", mid: "warning", low: "success" };

export default function DashboardRh() {
  const { t } = useI18n();
  const { role } = useSession();
  const navigate = useNavigate();
  const isManager = role === ROLES.MANAGER;
  const isExec = role === ROLES.RH || role === ROLES.DIRECTION || role === ROLES.ADMIN;
  const isMed = role === ROLES.MEDECINE;

  const { data, loading, error, reload } = useAsync(async () => {
    const [ov, rh, emps] = await Promise.all([
      getDashboardOverview(),
      getDashboardRh(),
      isMed ? Promise.resolve({ data: [] }) : getEmployees(),
    ]);
    return {
      blocks: (ov && ov.data && ov.data.blocks) || [],
      rh: (rh && rh.data) || {},
      employees: (emps && emps.data) || [],
    };
  });

  const [calc, setCalc] = useState(false);
  const [training, setTraining] = useState(false);
  const [batching, setBatching] = useState(false);
  const [selEmp, setSelEmp] = useState("");
  const [pred, setPred] = useState(null);
  const [predBusy, setPredBusy] = useState(false);
  const recalc = async () => { setCalc(true); try { await calculateRisques(); reload(); } catch (e) { /* */ } finally { setCalc(false); } };
  const trainMl = async () => { setTraining(true); try { await trainRiskModels(); } catch (e) { /* */ } finally { setTraining(false); } };
  const batchScore = async () => { setBatching(true); try { await batchScoreRisks(); reload(); } catch (e) { /* */ } finally { setBatching(false); } };
  const predictEmp = async (mat) => {
    setSelEmp(mat); setPred(null);
    if (!mat) return;
    setPredBusy(true);
    try { const r = await getRiskPrediction(mat); setPred((r && r.data) || null); }
    catch (e) { setPred(null); } finally { setPredBusy(false); }
  };

  const anomalies = data?.rh?.anomalies || [];

  // Raccourci d'action plein-largeur (rail).
  const Act = ({ icon: Icon, label, onClick, tone = "ghost" }) => (
    <button onClick={onClick} className={`sd-btn sd-btn--${tone} sd-btn--sm`}
      style={{ width: "100%", justifyContent: "flex-start", gap: 9 }}>
      <Icon size={15} /> <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      <ChevronRight size={14} style={{ opacity: 0.5 }} />
    </button>
  );

  return (
    <div>
      <style>{`@media (max-width:1080px){ .ck-grid{ grid-template-columns:1fr!important; } }`}</style>

      {/* Hero */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "20px 24px", borderRadius: "var(--r-xl)", border: "1px solid var(--line)",
        background: "var(--app-bg)", boxShadow: "var(--shadow-sm)",
      }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--gold-deep)", fontWeight: 700 }}>Synapse Digital</div>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 600, color: "var(--ink)", margin: "4px 0 0" }}>{t("nav.dashboard")}</h1>
        </div>
        <Badge tone="gold">{isManager ? t("scope.team") : t("scope.org")}</Badge>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {anomalies.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {anomalies.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: a.severite === "high" ? "var(--danger)" : "#9a6b12", background: a.severite === "high" ? "var(--danger-bg)" : "var(--warning-bg)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 12px" }}>
                ⚠️ {a.message}
              </div>
            ))}
          </div>
        )}

        <div className="ck-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 18, marginTop: 16, alignItems: "start" }}>
          {/* Colonne principale : les 5 blocs */}
          <OverviewBlocks blocks={data?.blocks || []} />

          {/* Rail droit : Mes tâches puis Actions rapides */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
            <AgendaTasks />

            <Card style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}><Zap size={16} /></div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("cockpit.quickActions")}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {!isMed && <Act icon={Inbox} label={t("nav.reqReview")} onClick={() => navigate("/rh/demandes")} tone="outline" />}
                {!isMed && <Act icon={BadgeCheck} label={t("nav.skills")} onClick={() => navigate("/rh/processus/carrieres")} />}
                {!isMed && <Act icon={Users} label={t("nav.team")} onClick={() => navigate("/rh/equipe")} />}
                {!isMed && <Act icon={ScanFace} label={t("nav.vision360")} onClick={() => navigate("/rh/vision")} />}
                {isMed && <Act icon={ScanFace} label={t("nav.happiness")} onClick={() => navigate("/rh/processus/happiness")} tone="outline" />}
              </div>

              {(isExec || isMed) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>Risques (ML)</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={recalc} disabled={calc} className="sd-btn sd-btn--ghost sd-btn--sm" title={t("rh.recalcRisk")}><Sparkles size={14} /> {calc ? "…" : t("rh.recalcRisk")}</button>
                    <button onClick={trainMl} disabled={training} className="sd-btn sd-btn--ghost sd-btn--sm" title={t("ml.train")}><Sparkles size={14} /> {training ? "…" : t("ml.train")}</button>
                    <button onClick={batchScore} disabled={batching} className="sd-btn sd-btn--ghost sd-btn--sm" title={t("ml.batch")}><Sparkles size={14} /> {batching ? "…" : t("ml.batch")}</button>
                  </div>
                  <select value={selEmp} onChange={(e) => predictEmp(e.target.value)} className="sd-field" style={{ marginTop: 8, width: "100%", fontSize: 12.5 }}>
                    <option value="">{t("cockpit.predict")}</option>
                    {(data?.employees || []).map((e) => (
                      <option key={e.id} value={e.id}>{`${e.prenom || ""} ${e.nom || ""}`.trim() || e.id}</option>
                    ))}
                  </select>
                  {predBusy && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>{t("common.loading")}</div>}
                  {pred && pred.trained === false && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>{t("ml.notrained")}</div>}
                  {pred && pred.risks && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {[["turnover", t("ml.turnover")], ["absent", t("ml.absent")], ["mobilite", t("ml.mobilite")]].map(([k, label]) => {
                        const r = pred.risks[k]; if (!r) return null;
                        return (
                          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                            <span style={{ color: "var(--muted)" }}>{label}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <b style={{ color: "var(--ink)" }}>{Math.round(r.proba * 100)}%</b>
                              <Badge tone={riskTone[r.niveau] || "info"}>{r.niveau}</Badge>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </AsyncBoundary>
    </div>
  );
}
