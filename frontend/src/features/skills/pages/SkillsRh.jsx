import { useState } from "react";
import { Star, BadgeCheck, Layers, Users, Plus, Trash2, Sparkles, Search } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import {
  getPendingEvaluations, getMetiers, getEmployees, getMetierRequises, getCompetences,
  getCompetenceRadar, getEvaluations, validateEvaluation, getMissingPostes, syncPostes,
  createMetier, deleteMetier, createCompetence, addCompetenceRequise, deleteCompetenceRequise,
} from "../../../lib/api";

const NIVEAUX = ["Junior", "Opérationnel", "Confirmé", "Senior"];

function Stars({ value = 0, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => onChange && onChange(n)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}>
            <Star size={16} color={active ? "var(--gold)" : "var(--line)"} fill={active ? "var(--gold)" : "none"} />
          </button>
        );
      })}
    </span>
  );
}

export default function SkillsRh() {
  const { t } = useI18n();
  const { role } = useSession();
  const canConfirm = role === ROLES.MANAGER || role === ROLES.ADMIN;   // seul le manager (ou admin) confirme

  const { data, loading, error, reload } = useAsync(async () => {
    const [pend, metiers, cat, missing] = await Promise.all([
      canConfirm ? getPendingEvaluations() : Promise.resolve({ data: [] }),
      getMetiers(), getCompetences(),
      getMissingPostes().catch(() => ({ data: [] })),
    ]);
    return { pending: (pend && pend.data) || [], metiers: (metiers && metiers.data) || [],
             catalogue: (cat && cat.data) || [], missing: (missing && missing.data) || [] };
  }, [canConfirm]);

  const PAGE_SIZE = 100;
  const [empPage, setEmpPage] = useState(1);
  const [empSearch, setEmpSearch] = useState("");
  const [empQuery, setEmpQuery] = useState("");
  const emp = useAsync(
    () => getEmployees({ page: empPage, page_size: PAGE_SIZE, ...(empQuery ? { search: empQuery } : {}) }),
    [empPage, empQuery]
  );
  const employees = (emp.data && emp.data.data) || [];
  const empTotal = (emp.data && emp.data.meta && emp.data.meta.total) || 0;
  const empPages = Math.max(1, Math.ceil(empTotal / PAGE_SIZE));
  const doSearch = (e) => { e.preventDefault(); setEmpPage(1); setEmpQuery(empSearch.trim()); };

  const [busy, setBusy] = useState(null);
  const [exp, setExp] = useState({});
  const [sortBy, setSortBy] = useState("date");   // date | nom
  const [metierReq, setMetierReq] = useState(null);
  const [selected, setSelected] = useState(null);  // { id, nom } collaborateur sélectionné
  const [radar, setRadar] = useState(null);
  const [skills, setSkills] = useState(null);      // liste des compétences du collaborateur
  const [newMetier, setNewMetier] = useState({ nom: "", description: "" });
  const [newComp, setNewComp] = useState({ nom: "", categorie: "hard" });
  const [newReq, setNewReq] = useState({ niveau: "Confirmé", id_competence: "", niveau_attendu: 3 });

  const fail = (e) => window.alert((e && (e.payload?.detail || e.message)) || "Erreur");

  const loadCollab = async (id, nom) => {
    setSelected({ id, nom });
    setRadar(null); setSkills(null);
    try {
      const [r, ev] = await Promise.all([getCompetenceRadar(id), getEvaluations(id)]);
      setRadar((r && r.data) || {});
      setSkills((ev && ev.data) || []);
    } catch (e) { setRadar({}); setSkills([]); }
  };
  const validate = async (id) => {
    if (!exp[id]) return;
    setBusy(id);
    try {
      await validateEvaluation(id, exp[id]);
      reload();
      if (selected) loadCollab(selected.id, selected.nom);   // rafraîchit niveau de poste + skills
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const openMetier = async (m) => {
    setMetierReq({ metier: m, rows: null });
    try { const r = await getMetierRequises(m.id); setMetierReq({ metier: m, rows: (r && r.data) || [] }); }
    catch (e) { setMetierReq({ metier: m, rows: [] }); }
  };
  const selectCollab = (e2) => loadCollab(e2.id, `${e2.prenom || ""} ${e2.nom || ""}`.trim() || e2.id);
  const setExpert = async (evalId, niveau) => {
    setBusy(`s${evalId}`);
    try {
      await validateEvaluation(evalId, niveau);
      if (selected) await loadCollab(selected.id, selected.nom);  // niveau de poste + skills recalculés
      reload();
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const addMetier = async () => {
    if (!newMetier.nom.trim()) return;
    setBusy("metier");
    try { await createMetier({ nom: newMetier.nom.trim(), description: newMetier.description || null }); setNewMetier({ nom: "", description: "" }); reload(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };
  const removeMetier = async (m) => {
    if (!window.confirm(`Supprimer le métier « ${m.nom} » ?`)) return;
    setBusy("metier");
    try { await deleteMetier(m.id); if (metierReq?.metier?.id === m.id) setMetierReq(null); reload(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };
  const addComp = async () => {
    if (!newComp.nom.trim()) return;
    setBusy("comp");
    try { await createCompetence({ nom: newComp.nom.trim(), categorie: newComp.categorie }); setNewComp({ nom: "", categorie: "hard" }); reload(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };
  const addReq = async () => {
    if (!metierReq?.metier || !newReq.id_competence) return;
    setBusy("req");
    try {
      await addCompetenceRequise(metierReq.metier.id, { niveau: newReq.niveau, id_competence: Number(newReq.id_competence), niveau_attendu: newReq.niveau_attendu });
      openMetier(metierReq.metier);
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const removeReq = async (id) => {
    setBusy("req");
    try { await deleteCompetenceRequise(id); openMetier(metierReq.metier); } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const runSync = async () => {
    setBusy("sync");
    try { const r = await syncPostes(); window.alert(`${(r?.data?.count) || 0} ${t("skills.metiersCreated")}`); reload(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };

  const missing = data?.missing || [];
  const catalogue = data?.catalogue || [];
  const pending = [...(data?.pending || [])].sort((a, b) =>
    sortBy === "nom"
      ? (a.nom_complet || "").localeCompare(b.nom_complet || "")
      : (b.date_evaluation || "").localeCompare(a.date_evaluation || ""));
  const radarData = (radar?.items || []).map((i) => ({ competence: i.competence, attendu: i.attendu, actuel: i.actuel }));
  const field = { height: 36, borderRadius: 8, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", outline: "none" };
  const reqByNiveau = {};
  for (const r of (metierReq?.rows || [])) (reqByNiveau[r.niveau] = reqByNiveau[r.niveau] || []).push(r);
  const goldBtn = { height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("skills.rhTitle")}</h1>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {/* File de validation — RÉSERVÉE au manager (son équipe) / admin */}
        {canConfirm && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <BadgeCheck size={17} color="var(--gold-deep)" /> {t("skills.queue")} <Badge tone="gold">{pending.length}</Badge>
              <label style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                {t("skills.sortBy")}
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...field, height: 30 }}>
                  <option value="date">{t("skills.sortDate")}</option>
                  <option value="nom">{t("skills.sortName")}</option>
                </select>
              </label>
            </div>
            {pending.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("skills.queueEmpty")}</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {pending.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)", opacity: busy === e.id ? 0.5 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{e.nom_complet}</span>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}> — {e.competence}</span>
                      <Badge tone={e.categorie === "soft" ? "info" : "gold"}>{e.categorie}</Badge>
                      {e.proposee && <Badge tone="success">{t("skills.newProposal")}</Badge>}
                      {e.date_evaluation && <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 4 }}>{e.date_evaluation}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("skills.self")} : {e.niveau_auto}/5</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("skills.expert")} :</span>
                    <Stars value={exp[e.id] || 0} onChange={(n) => setExp({ ...exp, [e.id]: n })} />
                    <button onClick={() => validate(e.id)} disabled={!exp[e.id] || busy === e.id} style={{ ...goldBtn, opacity: !exp[e.id] ? 0.6 : 1 }}>{t("skills.validate")}</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Postes à compléter — création auto des métiers manquants */}
        {missing.length > 0 && (
          <Card style={{ marginBottom: 16, borderLeft: "3px solid var(--gold)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Sparkles size={17} color="var(--gold-deep)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("skills.postesToComplete")}</span>
              <Badge tone="warning">{missing.length}</Badge>
              <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 200 }}>
                {missing.slice(0, 6).join(", ")}{missing.length > 6 ? "…" : ""}
              </span>
              <button onClick={runSync} disabled={busy === "sync"} style={goldBtn}>
                <Plus size={15} /> {t("skills.createMissing")} ({missing.length})
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{t("skills.createMissingHint")}</div>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Gestion du référentiel */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <Layers size={17} color="var(--gold-deep)" /> {t("skills.manageRef")}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={newMetier.nom} onChange={(e) => setNewMetier({ ...newMetier, nom: e.target.value })} placeholder={t("skills.metierName")} style={{ ...field, flex: 1 }} />
              <button onClick={addMetier} disabled={busy === "metier" || !newMetier.nom.trim()} style={{ ...goldBtn, opacity: !newMetier.nom.trim() ? 0.6 : 1 }}><Plus size={15} /> {t("skills.addMetier")}</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {(data?.metiers || []).map((m) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 6px 0 12px", borderRadius: 999, border: `1px solid ${metierReq?.metier?.id === m.id ? "var(--gold)" : "var(--line)"}`, background: metierReq?.metier?.id === m.id ? "var(--gold-tint)" : "transparent" }}>
                  <button onClick={() => openMetier(m)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{m.nom}</button>
                  <button onClick={() => removeMetier(m)} title={t("skills.delete")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", padding: 2 }}><Trash2 size={13} /></button>
                </span>
              ))}
            </div>
            {metierReq && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{metierReq.metier.nom}</div>
                {metierReq.rows === null ? <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div> :
                  Object.keys(reqByNiveau).length === 0 ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("skills.noRequis")}</div> :
                  Object.entries(reqByNiveau).map(([niv, rows]) => (
                    <div key={niv} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-deep)" }}>{niv}</div>
                      {rows.map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--ink)", padding: "2px 0" }}>
                          <span>{r.competence} <span style={{ color: "var(--muted)", fontSize: 11 }}>({r.categorie}) · {r.niveau_attendu}/5</span></span>
                          <button onClick={() => removeReq(r.id)} title={t("skills.delete")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex" }}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={newReq.niveau} onChange={(e) => setNewReq({ ...newReq, niveau: e.target.value })} style={{ ...field, width: 130 }}>
                    {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={newReq.id_competence} onChange={(e) => setNewReq({ ...newReq, id_competence: e.target.value })} style={{ ...field, flex: 1, minWidth: 140 }}>
                    <option value="">{t("skills.pickCompetence")}</option>
                    {catalogue.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                  <Stars value={newReq.niveau_attendu} onChange={(n) => setNewReq({ ...newReq, niveau_attendu: n })} />
                  <button onClick={addReq} disabled={busy === "req" || !newReq.id_competence} style={{ ...goldBtn, opacity: !newReq.id_competence ? 0.6 : 1 }}><Plus size={15} /></button>
                </div>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input value={newComp.nom} onChange={(e) => setNewComp({ ...newComp, nom: e.target.value })} placeholder={t("skills.newCompetence")} style={{ ...field, flex: 1, minWidth: 140 }} />
              <select value={newComp.categorie} onChange={(e) => setNewComp({ ...newComp, categorie: e.target.value })} style={{ ...field, width: 110 }}>
                <option value="hard">Hard</option><option value="soft">Soft</option>
              </select>
              <button onClick={addComp} disabled={busy === "comp" || !newComp.nom.trim()} style={{ ...goldBtn, opacity: !newComp.nom.trim() ? 0.6 : 1 }}><Plus size={15} /></button>
            </div>
          </Card>

          {/* Collaborateurs — liste recherchable + paginée ; clic → compétences */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
              <Users size={17} color="var(--gold-deep)" /> {t("skills.collabRadar")}
              {empTotal > 0 && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>({empTotal})</span>}
            </div>
            {/* Barre de recherche */}
            <form onSubmit={doSearch} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder={t("skills.searchCollab")} style={{ ...field, width: "100%", paddingLeft: 32, boxSizing: "border-box" }} />
              </div>
              <button type="submit" style={goldBtn}>{t("skills.searchBtn")}</button>
            </form>
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {emp.loading ? (
                  <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
                ) : employees.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>{t("skills.noCollab")}</div>
                ) : employees.map((e2, i) => {
                  const nom = `${e2.prenom || ""} ${e2.nom || ""}`.trim() || e2.id;
                  const sel = selected?.id === e2.id;
                  return (
                    <button key={e2.id} onClick={() => selectCollab(e2)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", gap: 10, padding: "9px 12px", border: "none", borderTop: i ? "1px solid var(--line)" : "none", background: sel ? "var(--gold-tint)" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: sel ? 600 : 400 }}>{nom}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>{e2.poste || "—"}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid var(--line)", background: "var(--field)" }}>
                <button onClick={() => setEmpPage((p) => Math.max(1, p - 1))} disabled={empPage <= 1 || emp.loading} style={{ ...goldBtn, height: 30, opacity: empPage <= 1 ? 0.5 : 1 }}>{t("skills.prev")}</button>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t("skills.page")} {empPage} / {empPages}</span>
                <button onClick={() => setEmpPage((p) => Math.min(empPages, p + 1))} disabled={empPage >= empPages || emp.loading} style={{ ...goldBtn, height: 30, opacity: empPage >= empPages ? 0.5 : 1 }}>{t("skills.next")}</button>
              </div>
            </div>

            {/* Compétences du collaborateur sélectionné */}
            {selected && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{selected.nom}</span>
                  {radar?.niveau_actuel && <Badge tone="gold">{t("skills.currentLevel")} : {radar.niveau_actuel}</Badge>}
                </div>
                {radarData.length > 0 && (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="70%">
                        <PolarGrid stroke="var(--line)" />
                        <PolarAngleAxis dataKey="competence" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                        <Radar name={t("skills.expected")} dataKey="attendu" stroke="var(--gold-deep)" fill="var(--gold-deep)" fillOpacity={0.12} />
                        <Radar name={t("skills.current")} dataKey="actuel" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.3} />
                        <Legend /><Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Liste des compétences — le manager peut modifier la note validée (stars) */}
                {skills === null ? (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
                ) : skills.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("skills.noData")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                    {canConfirm && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{t("skills.editHint")}</div>}
                    {skills.map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", padding: "5px 0", borderTop: "1px solid var(--line)", opacity: busy === `s${s.id}` ? 0.5 : 1 }}>
                        <span style={{ flex: 1 }}>{s.competence} <Badge tone={s.categorie === "soft" ? "info" : "gold"}>{s.categorie}</Badge></span>
                        {canConfirm ? (
                          <>
                            <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{t("skills.self")} {s.niveau_auto || 0}/5</span>
                            <Stars value={s.niveau_expert || 0} onChange={(n) => setExpert(s.id, n)} />
                            {s.statut === "valide" && <Badge tone="success">{t("skills.validated")}</Badge>}
                          </>
                        ) : (
                          <>
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>{s.niveau || s.niveau_auto || "—"}/5</span>
                            <Badge tone={s.statut === "valide" ? "success" : "warning"}>{s.statut === "valide" ? t("skills.validated") : t("skills.pending")}</Badge>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(radar?.gaps || []).length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
                    {t("skills.gaps")} : {radar.gaps.map((g) => `${g.competence} (${g.actuel}/${g.attendu})`).join(", ")}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </AsyncBoundary>
    </div>
  );
}
