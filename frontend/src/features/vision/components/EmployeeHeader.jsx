import { MapPin, Briefcase, UserCog, CalendarDays, ShieldAlert } from "lucide-react";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getVisionHeader } from "../../../lib/api";

const STATUT_TONE = { ACTIVE: "success", NEW: "gold", LEAVING: "warning" };
const RISK_TONE = { high: "danger", mid: "warning", low: "success" };

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
function anciennete(m) {
  if (m === null || m === undefined) return "—";
  const y = Math.floor(m / 12), mo = m % 12;
  return y ? `${y} an${y > 1 ? "s" : ""}${mo ? ` ${mo} m` : ""}` : `${mo} mois`;
}

function Chip({ icon: Icon, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>
      <Icon size={14} /> {children}
    </span>
  );
}

export default function EmployeeHeader({ matricule }) {
  const { data, loading, error, reload } = useAsync(() => getVisionHeader(matricule), [matricule]);
  const h = data?.data || {};
  return (
    <AsyncBoundary loading={loading} error={error} onRetry={reload}>
      <div style={{
        display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
        padding: "18px 22px", borderRadius: "var(--r-xl)", border: "1px solid var(--line)",
        background: "var(--app-bg)", boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
          background: "var(--grad-gold)", color: "var(--on-gold)", display: "grid", placeItems: "center",
          fontSize: 22, fontWeight: 700, boxShadow: "var(--shadow)",
        }}>{initials(h.nom)}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{h.nom || matricule}</h2>
            {h.statut && <Badge tone={STATUT_TONE[h.statut] || "info"}>{h.statut}</Badge>}
            {h.niveau_carriere && <Badge tone="gold">{h.niveau_carriere}</Badge>}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            <Chip icon={Briefcase}>{h.poste || "—"}</Chip>
            <Chip icon={MapPin}>{h.departement || "—"}{h.site ? ` · ${h.site}` : ""}</Chip>
            <Chip icon={CalendarDays}>{anciennete(h.anciennete_mois)} d'ancienneté</Chip>
            {h.manager_nom && <Chip icon={UserCog}>Manager : {h.manager_nom}</Chip>}
          </div>
        </div>

        {h.risque && (
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: "var(--r-md)",
            background: `var(--${RISK_TONE[h.risque.niveau] || "info"}-bg)`,
            border: "1px solid var(--line)",
          }}>
            <ShieldAlert size={20} color={`var(--${RISK_TONE[h.risque.niveau] || "info"})`} />
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Risque global</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{h.risque.valeur}% · {h.risque.niveau}</div>
            </div>
          </div>
        )}
      </div>
    </AsyncBoundary>
  );
}
