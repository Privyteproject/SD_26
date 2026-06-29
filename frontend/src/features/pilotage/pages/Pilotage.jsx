import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Scale, Building2, ShieldCheck } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getDashboardByDept, getFairnessAudit } from "../../../lib/api";

const ATTR = { genre: "Genre", tranche_age: "Tranche d'âge", site: "Site", contrat: "Contrat" };
const MODEL_KEY = { turnover: "ml.turnover", burnout: "ml.burnout", desengagement: "ml.desengagement" };

// Pilotage Direction (décisionnel, org) : comparatif inter-départements + gouvernance/équité ML (§4.1).
export default function Pilotage() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAsync(async () => {
    const [bd, fa] = await Promise.all([
      getDashboardByDept().catch(() => null),
      getFairnessAudit().catch(() => null),
    ]);
    return { byDept: (bd && bd.data) || [], fairness: (fa && fa.data) || null };
  });
  const byDept = data?.byDept || [];
  const fairness = data?.fairness;
  const audits = fairness?.audits || {};

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{t("pil.title")}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 18px" }}>{t("pil.sub")}</p>

      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        {/* Comparatif inter-départements */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
            <Building2 size={16} color="var(--gold-deep)" /> {t("pil.byDept")}
          </div>
          <div style={{ height: 260 }}>
            {byDept.length === 0 ? (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 }}>{t("common.none")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDept} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <XAxis dataKey="departement" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="turnover" name={t("pil.turnover")} fill="var(--danger)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absenteisme" name={t("pil.absence")} fill="var(--gold)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="engagement" name={t("pil.engagement")} fill="var(--info)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {byDept.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>{t("pil.dept")}</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("pil.effectif")}</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("pil.turnover")}</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("pil.absence")}</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>{t("pil.engagement")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byDept.map((d, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line-soft)", color: "var(--ink)" }}>
                      <td style={{ padding: "6px 8px" }}>{d.departement}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.effectif}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.turnover}%</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.absenteisme}%</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.engagement}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Équité & non-discrimination des modèles (§4.1) */}
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            <Scale size={16} color="var(--gold-deep)" /> {t("pil.fairness")}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>{t("pil.fairnessSub")}</div>

          {!fairness?.trained ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("ml.notrained")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                <ShieldCheck size={14} color="var(--success)" />
                {t("pil.excluded")} : <b style={{ color: "var(--ink)" }}>{(fairness.exclus_des_features || []).join(", ")}</b>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {Object.entries(audits).map(([model, attrs]) => (
                  <div key={model} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t(MODEL_KEY[model] || model)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(attrs).map(([attr, v]) => (
                        <div key={attr} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                          <span style={{ color: "var(--muted)" }}>{ATTR[attr] || attr}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <b style={{ color: "var(--ink)" }}>{v.disparate_impact_ratio}</b>
                            <Badge tone={v.biais_potentiel ? "danger" : "success"}>{v.biais_potentiel ? t("pil.bias") : t("pil.ok")}</Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
