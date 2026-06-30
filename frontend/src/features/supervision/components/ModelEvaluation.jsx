import { useState } from "react";
import { Sparkles, Scale, BrainCircuit } from "lucide-react";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { trainRiskModels, getFairnessAudit } from "../../../lib/api";

const MODEL_LABELS = {
  turnover: "Risque de départ (turnover)",
  burnout: "Risque de burnout",
  desengagement: "Désengagement",
};
const COLS = [
  ["accuracy", "Accuracy"], ["precision", "Précision"], ["recall", "Rappel"],
  ["f1", "F1-score"], ["roc_auc", "ROC-AUC"],
];

function metricColor(v) {
  if (v === null || v === undefined) return "var(--muted)";
  return v >= 0.8 ? "var(--success)" : v >= 0.6 ? "var(--warning)" : "var(--danger)";
}

export default function ModelEvaluation() {
  const [models, setModels] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fairness, setFairness] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyF, setBusyF] = useState(false);

  const evaluate = async () => {
    setBusy(true);
    try {
      const r = await trainRiskModels();
      setModels((r && r.data && r.data.models) || null);
      setMeta((r && r.data) || null);
    } catch (e) { /* ignore */ } finally { setBusy(false); }
  };
  const audit = async () => {
    setBusyF(true);
    try { const r = await getFairnessAudit(); setFairness((r && r.data) || null); }
    catch (e) { /* ignore */ } finally { setBusyF(false); }
  };

  const rows = models ? Object.entries(models) : [];

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--r-md)", background: "var(--gold-tint)", color: "var(--gold-deep)", display: "grid", placeItems: "center" }}>
          <BrainCircuit size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Évaluation des modèles (Random Forest)</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Métriques mesurées sur un jeu de test (25 %) — turnover, burnout, désengagement.</div>
        </div>
        <button onClick={evaluate} disabled={busy} className="sd-btn sd-btn--gold sd-btn--sm">
          <Sparkles size={15} /> {busy ? "Entraînement…" : "Entraîner & évaluer"}
        </button>
        <button onClick={audit} disabled={busyF} className="sd-btn sd-btn--outline sd-btn--sm">
          <Scale size={15} /> {busyF ? "Audit…" : "Audit d'équité"}
        </button>
      </div>

      {!models && !busy && (
        <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>
          Cliquez sur « Entraîner & évaluer » pour calculer les métriques des 3 modèles.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "8px 10px" }}>Modèle</th>
                {COLS.map(([, lab]) => <th key={lab} style={{ padding: "8px 10px" }}>{lab}</th>)}
                <th style={{ padding: "8px 10px" }}>Seuil</th>
                <th style={{ padding: "8px 10px" }}>TN/FP/FN/TP</th>
                <th style={{ padding: "8px 10px" }}>Test (pos.)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, m]) => (
                <tr key={name} style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}>
                  <td style={{ padding: "10px 10px", fontWeight: 600 }}>{MODEL_LABELS[name] || name}</td>
                  {m.trained === false ? (
                    <td colSpan={COLS.length + 3} style={{ padding: "10px", color: "var(--muted)" }}>Non entraîné ({m.reason || "—"})</td>
                  ) : (<>
                    {COLS.map(([k]) => (
                      <td key={k} style={{ padding: "10px 10px", fontWeight: 700, color: metricColor(m[k]) }}>
                        {m[k] === null || m[k] === undefined ? "—" : m[k].toFixed(3)}
                      </td>
                    ))}
                    <td style={{ padding: "10px 10px", color: "var(--muted)" }}>{m.threshold ?? "—"}</td>
                    <td style={{ padding: "10px 10px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {m.confusion_matrix ? `${m.confusion_matrix.tn}/${m.confusion_matrix.fp}/${m.confusion_matrix.fn}/${m.confusion_matrix.tp}` : "—"}
                    </td>
                    <td style={{ padding: "10px 10px", color: "var(--muted)" }}>{m.test_size} ({m.positives})</td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
          {meta && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            Turnover entraîné sur {meta.n_employes} collaborateurs · burnout/désengagement sur {meta.n_temporel} (historique antérieur au cutoff) · class_weight équilibré · attributs protégés (âge, genre, site, contrat) exclus des variables.
          </div>}
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, background: "var(--info-bg)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
            <b style={{ color: "var(--ink)" }}>Méthode :</b> <b>burnout</b> et <b>désengagement</b> sont des <b>prédictions à 12 mois</b> — features calculées sur le passé (≤ cutoff), étiquette mesurée sur la fenêtre future (cutoff → aujourd'hui). Features et cible proviennent de <b>fenêtres temporelles disjointes</b> → pas de fuite de cible, métriques honnêtes.
          </div>
        </div>
      )}

      {/* Audit d'équité (§4.1 — prévention des biais) */}
      {fairness && fairness.audits && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Audit d'équité — disparate impact (règle des 4/5)</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Taux de prédiction « à risque » par groupe protégé ; ratio &lt; 0,8 = biais potentiel à investiguer. Ces attributs ne sont PAS des variables du modèle.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(fairness.audits).map(([model, attrs]) => (
              <div key={model} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 12px", minWidth: 220, flex: "1 1 220px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{MODEL_LABELS[model] || model}</div>
                {Object.entries(attrs).map(([attr, v]) => (
                  <div key={attr} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
                    <span style={{ color: "var(--muted)" }}>{attr}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ color: "var(--ink)" }}>{v.disparate_impact_ratio}</b>
                      <Badge tone={v.biais_potentiel ? "danger" : "success"}>{v.biais_potentiel ? "à vérifier" : "OK"}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
