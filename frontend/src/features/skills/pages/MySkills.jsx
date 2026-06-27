import { useState } from "react";
import { Star, Plus, BadgeCheck, ChevronRight } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from "recharts";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import {
  getMe, getMyRequiredCompetences, getEvaluations, getCompetenceRadar,
  getTrajectoire, selfEvaluate, addCustomCompetence, getCompetences,
} from "../../../lib/api";

// Étoiles cliquables (0-5).
function Stars({ value = 0, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button key={n} type="button" disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)} onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => !readOnly && onChange && onChange(n)}
            style={{ background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "pointer", lineHeight: 0 }}>
            <Star size={18} color={active ? "var(--gold)" : "var(--line)"} fill={active ? "var(--gold)" : "none"} />
          </button>
        );
      })}
    </span>
  );
}

export default function MySkills() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const me = (await getMe()).data || {};
    const mat = me.id || me.matricule;
    const [req, evals, radar, traj, cat] = await Promise.all([
      getMyRequiredCompetences(), getEvaluations(mat), getCompetenceRadar(mat), getTrajectoire(mat),
      getCompetences(),
    ]);
    return { mat, required: (req && req.data) || [], reqMeta: (req && req.meta) || {},
             evals: (evals && evals.data) || [], radar: (radar && radar.data) || {},
             traj: (traj && traj.data) || {}, catalogue: (cat && cat.data) || [] };
  });

  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({ nom: "", categorie: "hard", niveau_auto: 0, commentaire: "" });
  const [pick, setPick] = useState({ id_competence: "", niveau_auto: 0 });

  const reqMeta = data?.reqMeta || {};
  const required = data?.required || [];
  const evals = data?.evals || [];
  const byComp = {}; for (const e of evals) byComp[e.id_competence] = e;
  const requiredIds = new Set(required.map((r) => r.id_competence));
  const extras = evals.filter((e) => !requiredIds.has(e.id_competence)); // custom / transverses
  // Compétences du catalogue (autres métiers) que le collaborateur n'a pas encore positionnées.
  const catalogue = data?.catalogue || [];
  const available = catalogue.filter((c) => !requiredIds.has(c.id) && !byComp[c.id]);

  const rate = async (id_competence, niveau_auto, commentaire) => {
    setBusy(true);
    try { await selfEvaluate({ id_competence, niveau_auto, commentaire }); reload(); }
    catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const addFromCatalogue = async () => {
    if (!pick.id_competence || !pick.niveau_auto) return;
    setBusy(true);
    try { await selfEvaluate({ id_competence: Number(pick.id_competence), niveau_auto: pick.niveau_auto });
      setPick({ id_competence: "", niveau_auto: 0 }); reload(); }
    catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const submitCustom = async () => {
    if (!custom.nom.trim() || !custom.niveau_auto) return;
    setBusy(true);
    try {
      await addCustomCompetence({ nom: custom.nom.trim(), categorie: custom.categorie,
        niveau_auto: custom.niveau_auto, commentaire: custom.commentaire || null });
      setCustom({ nom: "", categorie: "hard", niveau_auto: 0, commentaire: "" });
      reload();
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };

  const radarData = (data?.radar?.items || []).map((i) => ({ competence: i.competence, attendu: i.attendu, actuel: i.actuel }));
  const field = { height: 38, borderRadius: 9, border: "1px solid var(--line)", background: "var(--field)", color: "var(--ink)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("skills.myTitle")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("skills.mySub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {/* Métier + trajectoire */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("skills.metier")}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{reqMeta.metier || "—"} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>· {reqMeta.poste || ""}</span></div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("skills.currentLevel")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold-deep)", marginTop: 2 }}>{data?.traj?.niveau_actuel || data?.radar?.niveau_actuel || t("skills.levelNone")}</div>
            </div>
          </div>
          {(data?.traj?.niveaux || []).length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {data.traj.niveaux.map((n, i) => {
                const cur = n === (data?.traj?.niveau_actuel || data?.radar?.niveau_actuel);
                return (
                  <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: cur ? 700 : 600, color: cur ? "var(--on-gold)" : "var(--ink)", background: cur ? "var(--gold)" : "var(--gold-tint)", border: `1px solid ${cur ? "var(--gold)" : "var(--line)"}`, borderRadius: 999, padding: "4px 12px" }}>{n}</span>
                    {i < data.traj.niveaux.length - 1 && <ChevronRight size={15} color="var(--muted)" />}
                  </span>
                );
              })}
            </div>
          )}
        </Card>

        {/* Radar attendu vs actuel */}
        {radarData.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>{t("skills.radar")}</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="competence" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <Radar name={t("skills.expected")} dataKey="attendu" stroke="var(--gold-deep)" fill="var(--gold-deep)" fillOpacity={0.12} />
                  <Radar name={t("skills.current")} dataKey="actuel" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.3} />
                  <Legend /><Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Auto-positionnement sur les compétences attendues */}
        <Card style={{ marginBottom: 16, opacity: busy ? 0.7 : 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{t("skills.selfTitle")}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{t("skills.selfHint")}</div>
          {required.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("skills.noReferentiel")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {required.map((r) => {
                const e = byComp[r.id_competence];
                return (
                  <div key={r.id_competence} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, color: "var(--ink)" }}>{r.competence}</span>
                      <Badge tone={r.categorie === "soft" ? "info" : "gold"}>{r.categorie}</Badge>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{t("skills.expected")} : {r.niveau_attendu}/5</div>
                    </div>
                    {e?.statut === "valide" && <Badge tone="success"><BadgeCheck size={12} /> {t("skills.validated")} {e.niveau_expert}/5</Badge>}
                    <Stars value={e?.niveau_auto || 0} onChange={(n) => rate(r.id_competence, n, e?.commentaire)} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Compétences complémentaires (transverses / personnalisées) */}
        {extras.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("skills.extra")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {extras.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{e.competence} <Badge tone={e.categorie === "soft" ? "info" : "gold"}>{e.categorie}</Badge></span>
                  {e.statut === "valide" && <Badge tone="success">{t("skills.validated")} {e.niveau_expert}/5</Badge>}
                  <Stars value={e.niveau_auto || 0} onChange={(n) => rate(e.id_competence, n, e.commentaire)} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Ajouter une compétence existante (catalogue, issue d'un autre métier) */}
        <Card style={{ marginBottom: 16, opacity: busy ? 0.7 : 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{t("skills.addFromCatalogue")}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>{t("skills.fromCatalogueHint")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={pick.id_competence} onChange={(e) => setPick({ ...pick, id_competence: e.target.value })} style={{ ...field, flex: 1, minWidth: 220 }}>
              <option value="">{t("skills.pickFromCatalogue")}</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.categorie})</option>)}
            </select>
            <Stars value={pick.niveau_auto} onChange={(n) => setPick({ ...pick, niveau_auto: n })} />
            <button onClick={addFromCatalogue} disabled={busy || !pick.id_competence || !pick.niveau_auto}
              style={{ height: 38, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: (!pick.id_competence || !pick.niveau_auto) ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <Plus size={16} /> {t("skills.add")}
            </button>
          </div>
        </Card>

        {/* Ajouter une compétence personnalisée */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t("skills.addCustom")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input value={custom.nom} onChange={(e) => setCustom({ ...custom, nom: e.target.value })} placeholder={t("skills.skillName")} style={{ ...field, flex: 1, minWidth: 180 }} />
            <select value={custom.categorie} onChange={(e) => setCustom({ ...custom, categorie: e.target.value })} style={{ ...field, width: 130 }}>
              <option value="hard">Hard skill</option>
              <option value="soft">Soft skill</option>
            </select>
            <Stars value={custom.niveau_auto} onChange={(n) => setCustom({ ...custom, niveau_auto: n })} />
            <button onClick={submitCustom} disabled={busy || !custom.nom.trim() || !custom.niveau_auto}
              style={{ height: 38, padding: "0 16px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: (!custom.nom.trim() || !custom.niveau_auto) ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <Plus size={16} /> {t("skills.add")}
            </button>
          </div>
        </Card>
      </AsyncBoundary>
    </div>
  );
}
