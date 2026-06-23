const fs = require('fs');
let code = fs.readFileSync('frontend/src/features/alerts/pages/Alerts.jsx', 'utf8');

// Import Info / ClipboardList
code = code.replace(/import \{ AlertTriangle/, "import { AlertTriangle, ClipboardList");

// Import getActionPlan
code = code.replace(/getPrioritizedAlertes, resolveAlerte \} from "\.\.\/\.\.\/\.\.\/lib\/api";/, "getPrioritizedAlertes, resolveAlerte, getActionPlan } from \"../../../lib/api\";");

// Add state for plan
const stateCode = `  const [busy, setBusy] = useState(null);
  const [plans, setPlans] = useState({});

  const loadPlan = async (a) => {
    if (plans[a.id]) return;
    setBusy(a.id + "-plan");
    try {
      const res = await getActionPlan(a.matricule);
      setPlans(prev => ({ ...prev, [a.id]: (res && res.data) || null }));
    } catch (e) { /* ignore */ } finally { setBusy(null); }
  };
`;
code = code.replace(/  const \[busy, setBusy\] = useState\(null\);/, stateCode);

// Add the button & plan display logic inside the map
const renderLogic = `                <Badge tone={gravTone[a.gravite] || "info"}>{a.gravite}</Badge>
                {a.categorie === "risque_eleve" && a.matricule && !plans[a.id] && (
                  <button onClick={() => loadPlan(a)} disabled={busy === a.id + "-plan"} title="Voir plan d'action" style={{ height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--gold)", background: "transparent", color: "var(--gold-deep)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                    <ClipboardList size={15} /> Plan d'action
                  </button>
                )}
                <button onClick={() => resolve(a.id)} disabled={busy === a.id} title={t("al.resolve")}`;
code = code.replace(/                <Badge tone=\{gravTone\[a.gravite\] \|\| "info"\}>\{a.gravite\}<\/Badge>\n                <button onClick=\{\(\) => resolve\(a.id\)\} disabled=\{busy === a.id\} title=\{t\("al.resolve"\)\}/, renderLogic);

// Add plan content dropdown
const planBox = `              </Card>
              {plans[a.id] && (
                <div style={{ marginLeft: 56, padding: 16, background: "var(--field)", borderRadius: 10, border: "1px solid var(--gold-tint)", marginTop: -4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <ClipboardList size={14} color="var(--gold-deep)" /> Recommandations de l'IA (Plan d'action ciblé)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink)", fontSize: 13.5, lineHeight: 1.6 }}>
                    {(plans[a.id].actions || []).map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}
`;
code = code.replace(/              <\/Card>\n            \);/, planBox + "            );");

fs.writeFileSync('frontend/src/features/alerts/pages/Alerts.jsx', code);
