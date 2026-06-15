import { Activity } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { useSession } from "../../../app/providers/SessionProvider";
import { ROLES } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { RISK_LIST } from "../../../mock/mockData";

const tone = { high: "danger", mid: "warning", low: "success" };
const key = { high: "dis.high", mid: "dis.mid", low: "dis.low" };

export default function Disengagement() {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const anon = role === ROLES.MEDECINE; // vue anonymisée

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("dis.title")}</h1>
        {anon && <Badge tone="info">{t("dis.anon")}</Badge>}
      </div>

      <Card style={{ marginTop: 18, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: anon ? "1fr 1fr auto" : "1.2fr 1fr 1.4fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{anon ? "ID" : t("emp.name")}</span>
          <span>{t("emp.dept")}</span>
          {!anon && <span>{t("dis.factors")}</span>}
          <span>{t("dis.risk")}</span>
        </div>
        {RISK_LIST.map((r, i) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: anon ? "1fr 1fr auto" : "1.2fr 1fr 1.4fr auto", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
              <Activity size={15} color="var(--gold-deep)" />
              {anon ? `Collaborateur #${r.id}` : r.name}
            </span>
            <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{r.dept}</span>
            {!anon && <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.factors[lang]}</span>}
            <Badge tone={tone[r.level]}>{t(key[r.level])}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
