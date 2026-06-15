import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";

const NEW_HIRES = [
  { id: 1, name: "Lina Cherkaoui", dept: "Ventes", progress: 70 },
  { id: 2, name: "Yannick Keke", dept: "IT", progress: 50 },
  { id: 3, name: "Maya Sefrioui", dept: "Ops", progress: 20 },
];

export default function OnboardingRh() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("onbrh.title")}</h1>
      <Card style={{ padding: 0 }}>
        {NEW_HIRES.map((h, i) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>{h.name.charAt(0)}</span>
            <div style={{ width: 180 }}>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{h.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{h.dept}</div>
            </div>
            <div style={{ flex: 1, height: 8, background: "var(--gold-tint)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${h.progress}%`, height: "100%", background: "var(--gold)" }} />
            </div>
            <Badge tone="gold">{h.progress}%</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
