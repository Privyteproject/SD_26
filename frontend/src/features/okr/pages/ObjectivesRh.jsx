import { useState } from "react";
import { Target, ClipboardCheck, Plus } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import {
  getEmployees, getObjectifs, getBilans, createObjectif, createBilan, setObjectifStatus,
} from "../../../lib/api";

function currentPeriode() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export default function ObjectivesRh() {
  const { t } = useI18n();
  const { data, loading, error } = useAsync(async () => {
    const emps = await getEmployees({ page_size: 100 });
    return { employees: (emps && emps.data) || [] };
  });

  const [sel, setSel] = useState("");
  const [detail, setDetail] = useState({ objectifs: [], bilans: [] });
  const [busy, setBusy] = useState(false);
  const [obj, setObj] = useState({ type: "projet", titre: "", kr: "" });
  const [bil, setBil] = useState({ type: "trimestriel", synthese: "", points_forts: "", axes_amelioration: "" });

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
      setObj({ type: "projet", titre: "", kr: "" }); load(sel);
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
  const close = async (id) => { setBusy(true); try { await setObjectifStatus(id, "clos"); load(sel); } catch (e) {} finally { setBusy(false); } };

  const field = { height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const area = { ...field, height: "auto", minHeight: 60, padding: 10, width: "100%", resize: "vertical" };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("okr.rhTitle")}</h1>
      <AsyncBoundary loading={loading} error={error}>
        <Card style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("okr.pickCollab")}</label>
          <select value={sel} onChange={(e) => onSelect(e.target.value)} style={{ ...field, width: "100%", marginTop: 6 }}>
            <option value="">—</option>
            {(data?.employees || []).map((e) => (
              <option key={e.id} value={e.id}>{`${e.prenom || ""} ${e.nom || ""}`.trim() || e.id} — {e.poste || "—"}</option>
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
                <button onClick={addObj} disabled={busy || !obj.titre.trim()} style={{ marginTop: 10, height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: !obj.titre.trim() ? 0.6 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("okr.create")}</button>
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
                <button onClick={addBilan} disabled={busy || !bil.synthese.trim()} style={{ marginTop: 10, height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: !bil.synthese.trim() ? 0.6 : 1, fontFamily: "inherit" }}>{t("okr.saveBilan")}</button>
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
      </AsyncBoundary>
    </div>
  );
}
