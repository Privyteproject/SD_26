import { useI18n } from "../../../app/providers/I18nProvider";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import AsyncBoundary from "../../../components/AsyncBoundary";
import { useAsync } from "../../../lib/useAsync";
import { getEmployees } from "../../../lib/api";
import { STATUS_LABELS } from "../../../lib/constants";

const tone = { ACTIVE: "success", NEW: "info", LEAVING: "warning" };

export default function Employees() {
  const { t, lang } = useI18n();
  // GET /api/v1/employees -> { data: [...], meta, errors }
  const { data, loading, error, reload } = useAsync(() => getEmployees());
  const employees = (data && data.data) || [];

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)", margin: "0 0 18px" }}>{t("emp.title")}</h1>

      <AsyncBoundary loading={loading} error={error} onRetry={reload} empty={!employees.length} emptyLabel={t("emp.empty")}>
        <Card style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>{t("emp.name")}</span><span>{t("emp.dept")}</span><span>{t("emp.role")}</span><span>{t("emp.status")}</span>
          </div>
          {employees.map((e, i) => {
            const name = `${e.prenom || ""} ${e.nom || ""}`.trim() || e.email || "—";
            const status = e.status || "ACTIVE";
            return (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr auto", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold)", color: "var(--on-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{name.charAt(0)}</span>
                  {name}
                </span>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{e.department || e.department_id || "—"}</span>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{e.poste || "—"}</span>
                <Badge tone={tone[status]}>{STATUS_LABELS[status]?.[lang] || status}</Badge>
              </div>
            );
          })}
        </Card>
      </AsyncBoundary>
    </div>
  );
}
