import { useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Lightbulb, X, TrendingUp, Send } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardRisques, getEmployees, getActionPlan, createFeedback } from "../../../lib/api";

const tone = { high: "danger", mid: "warning", low: "success" };
const key = { high: "dis.high", mid: "dis.mid", low: "dis.low" };
const typeLabel = { turnover: "Risque de départ", burnout: "Burnout / absentéisme", desengagement: "Désengagement" };

// Détection précoce du désengagement : alimentée par les scores ML (table ScoreRisque).
export default function Disengagement() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const anon = role === ROLES.MEDECINE; // vue anonymisée

  const { data, loading, error, reload } = useAsync(async () => {
    const [sc, emps] = await Promise.all([getDashboardRisques(), getEmployees({ page_size: 100 })]);
    return { scores: (sc && sc.data) || [], employees: (emps && emps.data) || [] };
  });
  const [filter, setFilter] = useState("high"); // high par défaut : on montre l'urgent
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [plan, setPlan] = useState(null);
  const [planFor, setPlanFor] = useState("");
  const [fb, setFb] = useState({ note: "3", comment: "" });
  const [fbBusy, setFbBusy] = useState(false);
  const [fbMsg, setFbMsg] = useState("");
  const openPlan = async (mat) => {
    setPlanFor(mat); setPlan(null); setFb({ note: "3", comment: "" }); setFbMsg("");
    try { const r = await getActionPlan(mat); setPlan((r && r.data) || null); } catch (e) { setPlan({ actions: [] }); }
  };
  const sendFeedback = async () => {
    setFbBusy(true); setFbMsg("");
    try {
      await createFeedback({ employee_id: planFor, note_1_5: Number(fb.note),
                             categorie: "desengagement", commentaire: fb.comment || null });
      setFb({ note: "3", comment: "" }); setFbMsg(t("dis.feedbackSent"));
    } catch (e) { setFbMsg((e && (e.payload?.detail || e.message)) || t("common.error")); }
    finally { setFbBusy(false); }
  };
  // Agrège les facteurs explicatifs renvoyés par le plan d'action (par type de risque).
  const planFactors = () => {
    const risks = (plan && plan.risks) || {};
    const out = [];
    for (const k of ["turnover", "absent"]) {
      for (const f of ((risks[k] && risks[k].facteurs) || [])) out.push(f);
    }
    const seen = new Set();
    return out.filter((f) => (seen.has(f.label) ? false : seen.add(f.label)));
  };

  const nameById = {}, deptById = {};
  for (const e of (data?.employees || [])) {
    nameById[e.id] = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || e.id;
    deptById[e.id] = e.department || "—";
  }
  const all = (data?.scores || []);
  const counts = { high: 0, mid: 0, low: 0 };
  for (const s of all) counts[s.niveau] = (counts[s.niveau] || 0) + 1;
  const filtered = all.filter((s) => filter === "all" || s.niveau === filter)
    .sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pill = (lvl, label) => (
    <button onClick={() => { setFilter(lvl); setPage(1); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${filter === lvl ? "var(--gold)" : "var(--line)"}`, background: filter === lvl ? "var(--gold-tint)" : "transparent", color: "var(--ink)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
      {label}{lvl !== "all" && <Badge tone={tone[lvl]}>{counts[lvl] || 0}</Badge>}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("dis.title")}</h1>
        {anon && <Badge tone="info">{t("dis.anon")}</Badge>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {pill("high", t("dis.high"))}{pill("mid", t("dis.mid"))}{pill("low", t("dis.low"))}{pill("all", t("common.all") || "Tous")}
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!rows.length} emptyLabel={t("dis.empty")}>
        <Card style={{ marginTop: 14, padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: anon ? "1fr 1fr 1fr auto auto" : "1.4fr 1fr 1fr auto auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{anon ? "ID" : t("emp.name")}</span><span>{t("emp.dept")}</span><span>{t("dis.factors")}</span><span>{t("dis.risk")}</span><span></span>
          </div>
          {rows.map((s, i) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: anon ? "1fr 1fr 1fr auto auto" : "1.4fr 1fr 1fr auto auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                <Activity size={15} color="var(--gold-deep)" />
                {anon ? `Collaborateur #${s.employee_id}` : (nameById[s.employee_id] || s.employee_id)}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{anon ? "—" : (deptById[s.employee_id] || "—")}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{typeLabel[s.type] || s.type} · {Math.round((s.valeur ?? 0) * 100)}%</span>
              <Badge tone={tone[s.niveau] || "info"}>{t(key[s.niveau] || "dis.low")}</Badge>
              <button onClick={() => openPlan(s.employee_id)} title={t("dis.actionPlan")} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--gold-deep)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Lightbulb size={15} /></button>
            </div>
          ))}
        </Card>

        {/* Pagination — affiche tous les employés, page par page */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          <span>{filtered.length} {t("dis.results") || "résultats"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: safePage <= 1 ? "default" : "pointer", opacity: safePage <= 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={16} /></button>
            <span style={{ minWidth: 70, textAlign: "center" }}>{safePage} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: safePage >= totalPages ? "default" : "pointer", opacity: safePage >= totalPages ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={16} /></button>
          </div>
        </div>
      </AsyncBoundary>

      {planFor && (
        <div onClick={() => setPlanFor("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <Lightbulb size={18} color="var(--gold-deep)" /> {t("dis.actionPlan")} — {anon ? `#${planFor}` : (nameById[planFor] || planFor)}
              </div>
              <button onClick={() => setPlanFor("")} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>
            {!plan ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
            ) : (
              <>
                {/* Facteurs explicatifs (explicabilité §4.1) */}
                {planFactors().length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 7 }}>
                      <TrendingUp size={15} color="var(--gold-deep)" /> {t("dis.whyRisk")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {planFactors().map((f, i) => (
                        <div key={i} style={{ fontSize: 13, color: "var(--ink)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span>{f.label}</span>
                          <span style={{ color: "var(--muted)" }}>{f.valeur} <span style={{ opacity: 0.7 }}>(moy. {f.moyenne})</span> · {f.sens}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {(plan.actions || []).map((a, i) => <li key={i} style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>{a}</li>)}
                </ul>

                {/* Feedback interne (alimente le ML désengagement) */}
                <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t("dis.feedbackTitle")}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("dis.feedbackNote")}</label>
                    <select value={fb.note} onChange={(e) => setFb({ ...fb, note: e.target.value })}
                      style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 10px", fontFamily: "inherit" }}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <textarea value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })}
                    placeholder={t("dis.feedbackComment")} rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: 10, fontFamily: "inherit", fontSize: 13.5, resize: "vertical", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <button onClick={sendFeedback} disabled={fbBusy} style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: fbBusy ? "wait" : "pointer", opacity: fbBusy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
                      <Send size={15} /> {t("dis.feedbackSend")}
                    </button>
                    {fbMsg && <span style={{ fontSize: 12.5, color: "var(--gold-deep)" }}>{fbMsg}</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
