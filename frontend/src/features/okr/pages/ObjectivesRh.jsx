import { useState } from "react";
import { Target, ClipboardCheck, Plus, Users, Search } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import {
  getEmployees, getObjectifs, getBilans, createObjectif, createObjectifsBulk, createBilan,
  setObjectifStatus, getTeamObjectifs, updateKeyResult, updateKeyResultGroup,
} from "../../../lib/api";

function currentPeriode() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

// Récupère tous les collaborateurs visibles (toutes les pages) — pour la sélection groupée.
async function fetchAllEmployees() {
  const first = await getEmployees({ page: 1, page_size: 100 });
  const total = (first.meta && first.meta.total) || (first.data || []).length;
  const pages = Math.ceil(total / 100);
  let rows = first.data || [];
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, k) => getEmployees({ page: k + 2, page_size: 100 }))
    );
    rows = rows.concat(...rest.map((r) => r.data || []));
  }
  return rows;
}

export default function ObjectivesRh() {
  const { t } = useI18n();
  const { data, loading, error } = useAsync(async () => ({ employees: await fetchAllEmployees() }));
  const employees = data?.employees || [];

  // Liste des objectifs de l'équipe — le serveur regroupe déjà les objectifs partagés en une entrée.
  const teamObj = useAsync(() => getTeamObjectifs(currentPeriode()), []);
  const teamObjectifs = (teamObj.data && teamObj.data.data) || [];
  const [expanded, setExpanded] = useState(() => new Set());   // objectifs partagés dépliés
  const toggleExp = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [sel, setSel] = useState("");
  const [detail, setDetail] = useState({ objectifs: [], bilans: [] });
  const [busy, setBusy] = useState(false);
  const [obj, setObj] = useState({ type: "projet", titre: "", kr: "" });
  const [bil, setBil] = useState({ type: "trimestriel", synthese: "", points_forts: "", axes_amelioration: "" });

  // Affectation groupée
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSel, setBulkSel] = useState(() => new Set());
  const [bulkObj, setBulkObj] = useState({ type: "projet", titre: "", kr: "" });

  const load = async (mat) => {
    if (!mat) { setDetail({ objectifs: [], bilans: [] }); return; }
    const [o, b] = await Promise.all([getObjectifs(mat), getBilans(mat)]);
    setDetail({ objectifs: (o && o.data) || [], bilans: (b && b.data) || [] });
  };
  const onSelect = (mat) => { setSel(mat); load(mat); };

  const addObj = async () => {
    if (!sel || !obj.titre.trim()) return;
    setBusy(true);
    try {
      await createObjectif({ employee_id: sel, periode: currentPeriode(), type: obj.type, titre: obj.titre.trim(),
        key_results: obj.kr.trim() ? [{ libelle: obj.kr.trim(), progression: 0 }] : [] });
      setObj({ type: "projet", titre: "", kr: "" }); load(sel); teamObj.reload();
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const addBilan = async () => {
    if (!sel || !bil.synthese.trim()) return;
    setBusy(true);
    try {
      await createBilan({ employee_id: sel, type: bil.type, periode: currentPeriode(),
        synthese: bil.synthese.trim(), points_forts: bil.points_forts || null, axes_amelioration: bil.axes_amelioration || null });
      setBil({ type: "trimestriel", synthese: "", points_forts: "", axes_amelioration: "" }); load(sel);
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const close = async (id) => { setBusy(true); try { await setObjectifStatus(id, "clos"); load(sel); teamObj.reload(); } catch (e) { /* ignore */ } finally { setBusy(false); } };
  const saveTeamKr = async (id, progression, matricule, partage) => {
    setBusy(true);
    try {
      if (partage) await updateKeyResultGroup(id, { progression: Number(progression) });
      else await updateKeyResult(id, { progression: Number(progression) });
      teamObj.reload(); if (sel === matricule) load(sel);
    } catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };

  const empName = (e) => `${e.prenom || ""} ${e.nom || ""}`.trim() || e.id;
  const bulkFiltered = employees.filter((e) => {
    const q = bulkSearch.trim().toLowerCase();
    return !q || empName(e).toLowerCase().includes(q) || (e.poste || "").toLowerCase().includes(q);
  });
  const toggle = (id) => setBulkSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFilteredSelected = bulkFiltered.length > 0 && bulkFiltered.every((e) => bulkSel.has(e.id));
  const toggleAll = () => setBulkSel((s) => {
    const n = new Set(s);
    if (allFilteredSelected) bulkFiltered.forEach((e) => n.delete(e.id));
    else bulkFiltered.forEach((e) => n.add(e.id));
    return n;
  });
  const submitBulk = async () => {
    if (!bulkObj.titre.trim() || bulkSel.size === 0) return;
    setBusy(true);
    try {
      const r = await createObjectifsBulk({ employee_ids: [...bulkSel], periode: currentPeriode(),
        type: bulkObj.type, titre: bulkObj.titre.trim(),
        key_results: bulkObj.kr.trim() ? [{ libelle: bulkObj.kr.trim(), progression: 0 }] : [] });
      const created = r?.data?.created ?? 0;
      const skipped = (r?.data?.skipped || []).length;
      window.alert(`${created} ${t("okr.bulkDone")}${skipped ? ` · ${skipped} ${t("okr.bulkSkipped")}` : ""}`);
      setBulkObj({ type: "projet", titre: "", kr: "" }); setBulkSel(new Set());
      if (sel) load(sel); teamObj.reload();
    } catch (e) { window.alert((e && (e.payload?.detail || e.message)) || "Erreur"); } finally { setBusy(false); }
  };

  const field = { height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const area = { ...field, height: "auto", minHeight: 60, padding: 10, width: "100%", resize: "vertical" };
  const goldBtn = (disabled) => ({ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 });

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("okr.rhTitle")}</h1>
      <AsyncBoundary loading={loading} error={error}>
        {/* Affectation groupée */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={17} color="var(--gold-deep)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("okr.bulkTitle")}</span>
            <button onClick={() => setBulkOpen((v) => !v)} style={{ marginLeft: "auto", height: 30, padding: "0 12px", borderRadius: 7, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {bulkOpen ? t("okr.bulkHide") : t("okr.bulkShow")}
            </button>
          </div>

          {bulkOpen && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, opacity: busy ? 0.8 : 1 }}>
              {/* Sélection des collaborateurs */}
              <div>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <Search size={15} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} placeholder={t("okr.bulkSearch")} style={{ ...field, width: "100%", paddingLeft: 32 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <button onClick={toggleAll} style={{ background: "none", border: "none", color: "var(--gold-deep)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    {allFilteredSelected ? t("okr.bulkUnselectAll") : t("okr.bulkSelectAll")} ({bulkFiltered.length})
                  </button>
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{bulkSel.size} {t("okr.bulkSelected")}</span>
                </div>
                <div style={{ border: "1px solid var(--line)", borderRadius: 10, maxHeight: 240, overflowY: "auto" }}>
                  {bulkFiltered.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: "var(--muted)" }}>{t("okr.bulkNone")}</div>
                  ) : bulkFiltered.map((e, i) => (
                    <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer" }}>
                      <input type="checkbox" checked={bulkSel.has(e.id)} onChange={() => toggle(e.id)} style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }} />
                      <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{empName(e)}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{e.poste || "—"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Définition de l'objectif commun */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t("okr.bulkObjTitle")}</div>
                <select value={bulkObj.type} onChange={(e) => setBulkObj({ ...bulkObj, type: e.target.value })} style={{ ...field, width: "100%", marginBottom: 8 }}>
                  <option value="projet">{t("okr.type.projet")}</option>
                  <option value="developpement">{t("okr.type.developpement")}</option>
                </select>
                <input value={bulkObj.titre} onChange={(e) => setBulkObj({ ...bulkObj, titre: e.target.value })} placeholder={t("okr.objTitle")} style={{ ...field, width: "100%", marginBottom: 8 }} />
                <input value={bulkObj.kr} onChange={(e) => setBulkObj({ ...bulkObj, kr: e.target.value })} placeholder={t("okr.krLabel")} style={{ ...field, width: "100%", marginBottom: 10 }} />
                <button onClick={submitBulk} disabled={busy || !bulkObj.titre.trim() || bulkSel.size === 0} style={goldBtn(busy || !bulkObj.titre.trim() || bulkSel.size === 0)}>
                  <Plus size={15} /> {t("okr.bulkAssign")} ({bulkSel.size})
                </button>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{t("okr.bulkHint")}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Sélection d'un collaborateur (vue détaillée) */}
        <Card style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("okr.pickCollab")}</label>
          <select value={sel} onChange={(e) => onSelect(e.target.value)} style={{ ...field, width: "100%", marginTop: 6 }}>
            <option value="">—</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{empName(e)} — {e.poste || "—"}</option>
            ))}
          </select>
        </Card>

        {sel && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, opacity: busy ? 0.8 : 1 }}>
            {/* Objectifs du collaborateur */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("okr.objectives")} · {currentPeriode()}</div>
                {detail.objectifs.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("okr.empty")}</div> :
                  detail.objectifs.map((o) => (
                    <div key={o.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Target size={15} color="var(--gold-deep)" />
                        <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{o.titre}</span>
                        <Badge tone={o.type === "developpement" ? "info" : "gold"}>{t(`okr.type.${o.type}`)}</Badge>
                        {o.statut === "clos" ? <Badge tone="success">{t("okr.closed")}</Badge> :
                          <button onClick={() => close(o.id)} style={{ marginLeft: "auto", height: 28, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t("okr.close")}</button>}
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginLeft: o.statut === "clos" ? "auto" : 8 }}>{o.taux_realisation}%</span>
                      </div>
                      {o.key_results.map((k) => (
                        <div key={k.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", padding: "2px 0 2px 22px" }}>
                          <span>{k.libelle}</span><span>{k.progression}%</span>
                        </div>
                      ))}
                    </div>
                  ))}
              </Card>
              <Card>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("okr.define")}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={obj.type} onChange={(e) => setObj({ ...obj, type: e.target.value })} style={{ ...field, width: 160 }}>
                    <option value="projet">{t("okr.type.projet")}</option>
                    <option value="developpement">{t("okr.type.developpement")}</option>
                  </select>
                  <input value={obj.titre} onChange={(e) => setObj({ ...obj, titre: e.target.value })} placeholder={t("okr.objTitle")} style={{ ...field, flex: 1, minWidth: 180 }} />
                </div>
                <input value={obj.kr} onChange={(e) => setObj({ ...obj, kr: e.target.value })} placeholder={t("okr.krLabel")} style={{ ...field, width: "100%", marginTop: 8 }} />
                <button onClick={addObj} disabled={busy || !obj.titre.trim()} style={{ ...goldBtn(busy || !obj.titre.trim()), marginTop: 10 }}><Plus size={15} /> {t("okr.create")}</button>
              </Card>
            </div>

            {/* Bilans */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}><ClipboardCheck size={16} color="var(--gold-deep)" /> {t("okr.newBilan")}</div>
                <select value={bil.type} onChange={(e) => setBil({ ...bil, type: e.target.value })} style={{ ...field, width: "100%", marginBottom: 8 }}>
                  <option value="trimestriel">{t("okr.bilan.trimestriel")}</option>
                  <option value="projet">{t("okr.bilan.projet")}</option>
                </select>
                <textarea value={bil.synthese} onChange={(e) => setBil({ ...bil, synthese: e.target.value })} placeholder={t("okr.synthese")} style={area} />
                <textarea value={bil.points_forts} onChange={(e) => setBil({ ...bil, points_forts: e.target.value })} placeholder={t("okr.strengths")} style={{ ...area, marginTop: 8 }} />
                <textarea value={bil.axes_amelioration} onChange={(e) => setBil({ ...bil, axes_amelioration: e.target.value })} placeholder={t("okr.improve")} style={{ ...area, marginTop: 8 }} />
                <button onClick={addBilan} disabled={busy || !bil.synthese.trim()} style={{ ...goldBtn(busy || !bil.synthese.trim()), marginTop: 10 }}>{t("okr.saveBilan")}</button>
              </Card>
              {detail.bilans.length > 0 && (
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t("okr.bilans")}</div>
                  {detail.bilans.map((b) => (
                    <div key={b.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                      <Badge tone="gold">{t(`okr.bilan.${b.type}`)}</Badge> <span style={{ color: "var(--muted)" }}>{b.periode}</span>
                      {b.synthese && <div style={{ color: "var(--ink)", marginTop: 4 }}>{b.synthese}</div>}
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Tous les objectifs de l'équipe — avancement modifiable au même endroit */}
        <Card style={{ marginTop: 16, opacity: busy ? 0.8 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            <Target size={17} color="var(--gold-deep)" /> {t("okr.teamTitle")} · {currentPeriode()}
            {teamObjectifs.length > 0 && <Badge tone="gold">{teamObjectifs.length}</Badge>}
          </div>
          {teamObj.loading ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
          ) : teamObjectifs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("okr.empty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {teamObjectifs.map((o) => (
                <div key={o.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {o.partage
                      ? <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{o.titre}</span>
                      : <><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{o.nom_complet}</span>
                         <span style={{ fontSize: 13.5, color: "var(--ink)" }}>— {o.titre}</span></>}
                    <Badge tone={o.type === "developpement" ? "info" : "gold"}>{t(`okr.type.${o.type}`)}</Badge>
                    {o.partage && (
                      <button onClick={() => toggleExp(o.groupe_id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 10px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--field)", color: "var(--gold-deep)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        <Users size={12} /> {(o.membres || []).length} {t("okr.people")} {expanded.has(o.groupe_id) ? "▲" : "▼"}
                      </button>
                    )}
                    {o.statut === "clos" && <Badge tone="success">{t("okr.closed")}</Badge>}
                    <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.taux_realisation}%</span>
                  </div>
                  {o.partage && expanded.has(o.groupe_id) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 2px", paddingLeft: 2 }}>
                      {(o.membres || []).map((m, idx) => (
                        <span key={idx} style={{ fontSize: 12, color: "var(--ink)", background: "var(--gold-tint)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 10px" }}>{m}</span>
                      ))}
                    </div>
                  )}
                  {o.key_results.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0 0 2px" }}>{t("okr.noKr")}</div>
                  ) : o.key_results.map((k) => (
                    <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0 0" }}>
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--muted)" }}>{k.libelle}{k.cible ? ` · ${t("okr.target")}: ${k.cible}` : ""}</span>
                      <input type="range" min="0" max="100" step="5" defaultValue={k.progression}
                        onMouseUp={(e) => saveTeamKr(k.id, e.target.value, o.employee_id, o.partage)}
                        onTouchEnd={(e) => saveTeamKr(k.id, e.target.value, o.employee_id, o.partage)}
                        style={{ width: 150, accentColor: "var(--gold)" }} />
                      <span style={{ width: 40, textAlign: "right", fontSize: 12.5, color: "var(--muted)" }}>{k.progression}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{t("okr.teamHint")}</div>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
