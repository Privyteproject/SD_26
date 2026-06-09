import { useState, useEffect } from "react";
import { Check, UserMinus } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { DEPARTURES, OFFBOARDING_STEPS } from "../../../mock/mockData";
import { getOffboardingSteps } from "../../../app/api/services";

export default function Offboarding() {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(DEPARTURES[0].id);
  const dep = DEPARTURES.find((d) => d.id === active) || DEPARTURES[0];

  const [stepsData, setStepsData] = useState(OFFBOARDING_STEPS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOffboardingSteps()
      .then((res) => {
        if (!cancelled && res.data) setStepsData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("offb.title")}</h1>
      
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--gold-tint)", color: "var(--gold-deep)", fontSize: 13, marginBottom: 14 }}>
          ⚠ API unavailable — showing mock data. ({error})
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <Card style={{ padding: 0 }}>
          {DEPARTURES.map((d, i) => (
            <button key={d.id} onClick={() => setActive(d.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderTop: i ? "1px solid var(--line)" : "none", background: d.id === active ? "var(--gold-tint)" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>{d.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.date}</div>
              </div>
              <Badge tone="gold">{d.progress}%</Badge>
            </button>
          ))}
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <UserMinus size={18} color="var(--gold-deep)" />
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{dep.name}</div>
            <Badge tone="gold">{dep.progress}%</Badge>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>{t("offb.checklist")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {stepsData.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: s.done ? "var(--muted)" : "var(--ink)" }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1px solid ${s.done ? "var(--gold)" : "var(--line)"}`, background: s.done ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.done && <Check size={13} color="var(--on-gold)" strokeWidth={3} />}
                </span>
                <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{typeof s.label === 'string' ? s.label : s.label[lang]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
