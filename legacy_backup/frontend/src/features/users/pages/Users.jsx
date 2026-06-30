import { Check, Minus, Plus } from "lucide-react";
import { useI18n } from "../../../app/providers/I18nProvider";
import { ROLE_LABELS } from "../../../lib/constants";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import { ADMIN_USERS, PERM_MODULES, PERM_GRID, ROLE_SHORT } from "../../../mock/mockData";

const ROLE_ORDER = ["COLLABORATEUR", "MANAGER", "RH", "DIRECTION", "ADMIN", "MEDECINE"];

function Cell({ v }) {
  if (v === "RW") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, background: "var(--gold)", color: "var(--on-gold)", alignItems: "center", justifyContent: "center" }}><Check size={13} strokeWidth={3} /></span>;
  if (v === "R") return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, border: "1px solid var(--gold)", color: "var(--gold-deep)", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>R</span>;
  return <span style={{ color: "var(--muted)" }}><Minus size={14} /></span>;
}

export default function Users() {
  const { t, lang } = useI18n();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t("usr.title")}</h1>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={17} /> {t("usr.user")}
        </button>
      </div>

      {/* Liste utilisateurs */}
      <Card style={{ marginTop: 18, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>{t("usr.user")}</span><span>{t("emp.role")}</span><span>{t("usr.last")}</span>
        </div>
        {ADMIN_USERS.map((u, i) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{u.name.charAt(0)}</span>
              {u.name}
            </span>
            <span><Badge tone="gold">{ROLE_LABELS[u.role][lang]}</Badge></span>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "monospace" }}>{u.last}</span>
          </div>
        ))}
      </Card>

      {/* Matrice rôles x permissions */}
      <div style={{ marginTop: 24, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("usr.matrix")}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 10px" }}>{t("usr.legend")}</div>
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid var(--line)" }}>{t("usr.module")}</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} style={{ padding: "12px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>{ROLE_SHORT[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_MODULES.map((m, i) => (
              <tr key={m.key}>
                <td style={{ padding: "12px 16px", fontSize: 13.5, color: "var(--ink)", fontWeight: 500, borderTop: i ? "1px solid var(--line)" : "none" }}>{m.label[lang]}</td>
                {ROLE_ORDER.map((r) => (
                  <td key={r} style={{ textAlign: "center", padding: "12px 8px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                    <Cell v={PERM_GRID[m.key][r]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
