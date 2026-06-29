import { useState } from "react";
import { AlertTriangle, ClipboardList, ShieldAlert, Check, Calendar, LifeBuoy, Activity, FileWarning, X, History, User } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getPrioritizedAlertes, getAlertesHistory, resolveAlerte, getActionPlan } from "../../../lib/api";

const gravTone = { high: "danger", mid: "warning", med: "warning", low: "info" };
const gravKey = { high: "al.high", mid: "al.med", med: "al.med", low: "al.low" };
const ICON = { securite: ShieldAlert, acces_refuse: ShieldAlert, acces_refuse_repete: ShieldAlert,
  escalade: LifeBuoy, absence: Calendar, risque_eleve: Activity, fuite_donnees: FileWarning };
const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB") : "—");
const fmtDay = (iso, lang) => (iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—");

export default function Alerts() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState("todo"); // todo | history

  const { data, loading, error, reload } = useAsync(async () => {
    const res = tab === "history"
      ? await getAlertesHistory({ limit: 200 })
      : await getPrioritizedAlertes({ include_resolved: false });
    return (res && res.data) || [];
  }, [tab]);
  const rows = data || [];
  const [busy, setBusy] = useState(null);

  // Modal de traitement
  const [modalAlerte, setModalAlerte] = useState(null);
  const [aiActions, setAiActions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState("");

  const extraOptions = [t("al.opt.interview"), t("al.opt.workload"), t("al.opt.mgr"), t("al.opt.training"), t("al.opt.mobility")];

  const openModal = async (a) => {
    setBusy(a.id + "-plan");
    try {
      const res = await getActionPlan(a.matricule);
      const actions = (res && res.data && res.data.actions) || [];
      setAiActions(actions);
      setSelected(actions.slice());   // plan proposé par l'IA pré-coché
      setNote("");
      setModalAlerte(a);
    } catch (e) { setAiActions([]); setSelected([]); setNote(""); setModalAlerte(a); }
    finally { setBusy(null); }
  };

  const toggle = (opt) => setSelected((s) => s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]);

  const resolveQuick = async (id) => {
    setBusy(id);
    try { await resolveAlerte(id); reload(); } catch (e) { /* */ } finally { setBusy(null); }
  };

  const submitPlan = async () => {
    if (!modalAlerte || (selected.length === 0 && !note.trim())) return;
    setBusy("submit-plan");
    try {
      await resolveAlerte(modalAlerte.id, { plan_action: selected, note: note.trim() || null });
      window.dispatchEvent(new CustomEvent("toast", { detail: { type: "success", message: t("al.planSubmitted") } }));
      setModalAlerte(null);
      reload();
    } catch (e) {
      window.dispatchEvent(new CustomEvent("toast", { detail: { type: "error", message: t("al.planError") } }));
    } finally { setBusy(null); }
  };

  const Tab = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)} className={`sd-btn sd-btn--sm ${tab === id ? "sd-btn--gold" : "sd-btn--ghost"}`}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("al.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>{tab === "history" ? t("al.historySub") : t("al.worklist")}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Tab id="todo" icon={AlertTriangle} label={t("al.tab.todo")} />
        <Tab id="history" icon={History} label={t("al.tab.history")} />
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!rows.length}
        emptyLabel={tab === "history" ? t("al.history.empty") : t("al.empty")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((a) => {
            const Icon = ICON[a.categorie] || AlertTriangle;
            const plan = (a.plan_action || "").split("\n").filter(Boolean);
            return (
              <Card key={a.id} style={{ opacity: busy === a.id ? 0.5 : 1, borderColor: a.gravite === "high" && !a.resolue ? "var(--danger)" : "var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: a.resolue ? "var(--field)" : "var(--gold-tint)", color: a.resolue ? "var(--muted)" : (a.gravite === "high" ? "var(--danger)" : "var(--gold-deep)"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{a.message}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.categorie} · {fmt(a.date_creation, lang)}</div>
                  </div>
                  <Badge tone={gravTone[a.gravite] || "info"}>{t(gravKey[a.gravite] || "al.low")}</Badge>
                  {tab === "history" ? (
                    <Badge tone="success">{t("al.handled")}</Badge>
                  ) : a.matricule ? (
                    <button onClick={() => openModal(a)} disabled={busy === a.id + "-plan"} className="sd-btn sd-btn--outline sd-btn--sm">
                      <ClipboardList size={15} /> {t("al.treat")}
                    </button>
                  ) : (
                    <button onClick={() => resolveQuick(a.id)} disabled={busy === a.id} className="sd-btn sd-btn--outline sd-btn--sm">
                      <Check size={15} /> {t("al.resolve")}
                    </button>
                  )}
                </div>

                {/* Historique : motif + plan d'action retenu + note + auteur */}
                {tab === "history" && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--faint)", marginBottom: 4 }}>{t("al.plan")}</div>
                      {plan.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                          {plan.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      ) : <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("al.noPlan")}</div>}
                    </div>
                    {a.note_resolution && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--faint)", marginBottom: 4 }}>{t("al.note")}</div>
                        <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{a.note_resolution}</div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><User size={13} /> {a.resolu_par || "—"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={13} /> {t("al.resolvedOn")} {fmtDay(a.date_resolution, lang)}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </AsyncBoundary>

      {/* Modal de traitement (plan d'action + note) */}
      {modalAlerte && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, width: 520, maxWidth: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={20} color="var(--gold-deep)" /> {t("al.proposePlan")}
              </h2>
              <button onClick={() => setModalAlerte(null)} aria-label={t("al.cancel")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24, overflowY: "auto" }}>
              {/* Motif */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{t("al.motif")}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", padding: "10px 14px", background: "var(--field)", borderRadius: 8, border: "1px solid var(--line)" }}>{modalAlerte.message}</div>
              </div>

              {/* Plan proposé par l'IA (pré-coché, validable) */}
              {aiActions.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-deep)", marginBottom: 8 }}>{t("al.aiProposed")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {aiActions.map((opt) => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--ink)", padding: "9px 12px", border: "1px solid", borderRadius: 8, background: selected.includes(opt) ? "var(--gold-tint)" : "transparent", borderColor: selected.includes(opt) ? "var(--gold)" : "var(--line)" }}>
                        <input type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--gold)" }} checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions complémentaires */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t("al.extraActions")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {extraOptions.map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--ink)", padding: "9px 12px", border: "1px solid", borderRadius: 8, background: selected.includes(opt) ? "var(--gold-tint)" : "transparent", borderColor: selected.includes(opt) ? "var(--gold)" : "var(--line)" }}>
                    <input type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--gold)" }} checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                    {opt}
                  </label>
                ))}
              </div>

              {/* Note */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{t("al.note")}</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("al.notePlaceholder")} rows={3}
                className="sd-field" style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: 13.5 }} />
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setModalAlerte(null)} className="sd-btn sd-btn--outline">{t("al.cancel")}</button>
              <button disabled={(selected.length === 0 && !note.trim()) || busy === "submit-plan"} onClick={submitPlan} className="sd-btn sd-btn--gold">
                {busy === "submit-plan" ? t("al.submitting") : t("al.confirmTreat")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
