import { useState } from "react";
import { Target, ClipboardCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getMe, getObjectifs, getBilans, updateKeyResult } from "../../../lib/api";

function currentPeriode() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function ProgressBar({ value }) {
  return (
    <div style={{ flex: 1, height: 8, background: "var(--gold-tint)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: "var(--gold)" }} />
    </div>
  );
}

export default function MyObjectives() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const me = (await getMe()).data || {};
    const mat = me.id || me.matricule;
    const [obj, bil] = await Promise.all([getObjectifs(mat), getBilans(mat)]);
    return { mat, objectifs: (obj && obj.data) || [], bilans: (bil && bil.data) || [] };
  });

  const [busy, setBusy] = useState(false);

  const saveKr = async (id, progression) => {
    setBusy(true);
    try { await updateKeyResult(id, { progression: Number(progression) }); reload(); }
    catch (e) { /* ignore */ } finally { setBusy(false); }
  };

  const objectifs = data?.objectifs || [];
  const bilans = data?.bilans || [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("okr.myTitle")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("okr.mySub")} · {currentPeriode()}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: busy ? 0.8 : 1 }}>
          {objectifs.length === 0 && <Card style={{ color: "var(--muted)", fontSize: 14 }}>{t("okr.empty")}</Card>}
          {objectifs.map((o) => (
            <Card key={o.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Target size={18} color="var(--gold-deep)" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{o.titre}</span>
                <Badge tone={o.type === "developpement" ? "info" : "gold"}>{t(`okr.type.${o.type}`)}</Badge>
                {o.partage && <Badge tone="info">{t("okr.shared")}</Badge>}
                {o.statut === "clos" && <Badge tone="success">{t("okr.closed")}</Badge>}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.taux_realisation}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <ProgressBar value={o.taux_realisation} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {o.key_results.map((k) => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{k.libelle}{k.cible ? <span style={{ color: "var(--muted)" }}> · {t("okr.target")}: {k.cible}</span> : null}</span>
                    {o.partage ? (
                      <div style={{ width: 160, height: 8, background: "var(--gold-tint)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ width: `${k.progression}%`, height: "100%", background: "var(--gold)" }} />
                      </div>
                    ) : (
                      <input type="range" min="0" max="100" step="5" defaultValue={k.progression}
                        onMouseUp={(e) => saveKr(k.id, e.target.value)} onTouchEnd={(e) => saveKr(k.id, e.target.value)}
                        style={{ width: 160, accentColor: "var(--gold)" }} />
                    )}
                    <span style={{ width: 42, textAlign: "right", fontSize: 13, color: "var(--muted)" }}>{k.progression}%</span>
                  </div>
                ))}
                {o.partage && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t("okr.sharedReadonly")}</div>}
              </div>
            </Card>
          ))}

          {/* Les objectifs sont fixés par le manager ; le collaborateur suit l'avancement. */}
          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "0 2px" }}>{t("okr.collabHint")}</div>

          {/* Bilans */}
          {bilans.length > 0 && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
                <ClipboardCheck size={17} color="var(--gold-deep)" /> {t("okr.bilans")}
              </div>
              {bilans.map((b) => (
                <div key={b.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge tone="gold">{t(`okr.bilan.${b.type}`)}</Badge>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>{b.periode}</span>
                  </div>
                  {b.synthese && <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 6 }}>{b.synthese}</div>}
                  {b.points_forts && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}><b>{t("okr.strengths")} :</b> {b.points_forts}</div>}
                  {b.axes_amelioration && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}><b>{t("okr.improve")} :</b> {b.axes_amelioration}</div>}
                </div>
              ))}
            </Card>
          )}
        </div>
      </AsyncBoundary>
    </div>
  );
}
